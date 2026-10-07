import { query } from '../../database/connection';

const CONSULTATION_DURATION_MINUTES = 30;

interface CapacityCalculationResult {
  date: string;
  calculated_capacity: number;
  configured_capacity: number | null;
  final_capacity: number;
  registered_count: number;
  remaining_capacity: number;
  consultation_duration_minutes: number;
}

interface TimeRange {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

/**
 * Calculate the duration in minutes between two time strings (HH:MM format)
 */
function calculateMinutesBetween(start: string, end: string): number {
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
}

/**
 * Merge overlapping or adjacent time ranges
 */
function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  
  // Sort by start time
  const sorted = [...ranges].sort((a, b) => 
    a.start.localeCompare(b.start)
  );
  
  const merged: TimeRange[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    const lastEndMinutes = calculateMinutesBetween('00:00', last.end);
    const currentStartMinutes = calculateMinutesBetween('00:00', current.start);
    
    // If current starts before or at the end of last, merge them
    if (currentStartMinutes <= lastEndMinutes) {
      const currentEndMinutes = calculateMinutesBetween('00:00', current.end);
      if (currentEndMinutes > lastEndMinutes) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Calculate total available minutes from time ranges
 */
function calculateTotalMinutes(ranges: TimeRange[]): number {
  return ranges.reduce((total, range) => {
    return total + calculateMinutesBetween(range.start, range.end);
  }, 0);
}

/**
 * Calculate capacity for a specific doctor and date
 */
export async function calculateCapacity(
  doctorId: string,
  date: string
): Promise<CapacityCalculationResult> {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Check if the date is fully unavailable (exception)
  const unavailabilityResult = await query(
    `SELECT * FROM doctor_unavailability
     WHERE doctor_id = $1 AND is_active = true
     AND start_date <= $2 AND end_date >= $2`,
    [doctorId, date]
  );
  
  // If there's a full-day exception, capacity is 0
  if (unavailabilityResult.rows.length > 0) {
    return {
      date,
      calculated_capacity: 0,
      configured_capacity: null,
      final_capacity: 0,
      registered_count: 0,
      remaining_capacity: 0,
      consultation_duration_minutes: CONSULTATION_DURATION_MINUTES,
    };
  }
  
  // Get working hours for this day of week
  const schedulesResult = await query(
    `SELECT start_time, end_time FROM doctor_schedules
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true
     ORDER BY start_time`,
    [doctorId, dayOfWeek]
  );
  
  if (schedulesResult.rows.length === 0) {
    // No working hours for this day
    return {
      date,
      calculated_capacity: 0,
      configured_capacity: null,
      final_capacity: 0,
      registered_count: 0,
      remaining_capacity: 0,
      consultation_duration_minutes: CONSULTATION_DURATION_MINUTES,
    };
  }
  
  // Get working hour ranges
  const workingRanges: TimeRange[] = schedulesResult.rows.map(row => ({
    start: row.start_time,
    end: row.end_time,
  }));
  
  // Get break periods for this date
  const breaksResult = await query(
    `SELECT start_time, end_time FROM doctor_break_periods
     WHERE doctor_id = $1 AND break_date = $2 AND is_active = true
     ORDER BY start_time`,
    [doctorId, date]
  );
  
  const breakRanges: TimeRange[] = breaksResult.rows.map(row => ({
    start: row.start_time,
    end: row.end_time,
  }));
  
  // Subtract break periods from working hours
  const availableRanges: TimeRange[] = [];
  
  for (const workRange of workingRanges) {
    const workStartMinutes = calculateMinutesBetween('00:00', workRange.start);
    const workEndMinutes = calculateMinutesBetween('00:00', workRange.end);
    
    let availableSegments = [{ start: workRange.start, end: workRange.end }];
    
    // Subtract each break period
    for (const breakRange of breakRanges) {
      const newSegments: TimeRange[] = [];
      
      for (const segment of availableSegments) {
        const segStartMinutes = calculateMinutesBetween('00:00', segment.start);
        const segEndMinutes = calculateMinutesBetween('00:00', segment.end);
        const breakStartMinutes = calculateMinutesBetween('00:00', breakRange.start);
        const breakEndMinutes = calculateMinutesBetween('00:00', breakRange.end);
        
        // If break is completely outside segment, keep segment
        if (breakEndMinutes <= segStartMinutes || breakStartMinutes >= segEndMinutes) {
          newSegments.push(segment);
        } else {
          // Break overlaps with segment - split it
          if (breakStartMinutes > segStartMinutes) {
            newSegments.push({
              start: segment.start,
              end: breakRange.start,
            });
          }
          if (breakEndMinutes < segEndMinutes) {
            newSegments.push({
              start: breakRange.end,
              end: segment.end,
            });
          }
        }
      }
      
      availableSegments = newSegments;
    }
    
    availableRanges.push(...availableSegments);
  }
  
  // Calculate total available minutes
  const totalAvailableMinutes = calculateTotalMinutes(availableRanges);

  // Calculate capacity based on consultation duration
  const calculated_capacity = Math.floor(totalAvailableMinutes / CONSULTATION_DURATION_MINUTES);

  // Get existing configured capacity
  const existingCapacityResult = await query(
    `SELECT configured_capacity, registered_count FROM daily_capacities
     WHERE doctor_id = $1 AND date = $2`,
    [doctorId, date]
  );

  let configured_capacity: number | null = null;
  let registered_count = 0;

  if (existingCapacityResult.rows.length > 0) {
    configured_capacity = existingCapacityResult.rows[0].configured_capacity;
    registered_count = existingCapacityResult.rows[0].registered_count || 0;
  }

  // Final capacity is the minimum of calculated and configured
  const final_capacity = configured_capacity !== null
    ? Math.min(calculated_capacity, configured_capacity)
    : calculated_capacity;

  const remaining_capacity = Math.max(0, final_capacity - registered_count);

  return {
    date,
    calculated_capacity,
    configured_capacity,
    final_capacity,
    registered_count,
    remaining_capacity,
    consultation_duration_minutes: CONSULTATION_DURATION_MINUTES,
  };
}

/**
 * Calculate capacity for a date range
 */
export async function calculateCapacityRange(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, CapacityCalculationResult>> {
  const results = new Map<string, CapacityCalculationResult>();
  
  const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    const capacity = await calculateCapacity(doctorId, dateStr);
    results.set(dateStr, capacity);
  }
  
  return results;
}
