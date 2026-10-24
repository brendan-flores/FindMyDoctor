import { query } from '../../database/connection';

const CONSULTATION_DURATION_MINUTES = 30;

export interface CapacityCalculationResult {
  date: string;
  calculated_capacity: number;
  configured_capacity: number | null;
  final_capacity: number;
  registered_count: number;
  remaining_capacity: number;
  consultation_duration_minutes: number;
}

export interface TimeRange {
  start: string; // HH:MM format
  end: string; // HH:MM format
}

/**
 * Pre-fetched schedule inputs for a single date. Used by dashboard endpoints
 * that already load the doctor's working hours, breaks and exceptions, so the
 * capacity calculation does not repeat those three queries.
 */
export interface CapacityContext {
  hasUnavailability: boolean;
  workingRanges: TimeRange[];
  breakRanges: TimeRange[];
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
 * Calculate total available minutes from time ranges
 */
function calculateTotalMinutes(ranges: TimeRange[]): number {
  return ranges.reduce((total, range) => {
    return total + calculateMinutesBetween(range.start, range.end);
  }, 0);
}

/**
 * Subtract break ranges from working ranges.
 */
function subtractBreaks(workingRanges: TimeRange[], breakRanges: TimeRange[]): TimeRange[] {
  const availableRanges: TimeRange[] = [];

  for (const workRange of workingRanges) {
    let availableSegments = [{ start: workRange.start, end: workRange.end }];

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

  return availableRanges;
}

function emptyCapacityResult(date: string): CapacityCalculationResult {
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

/**
 * Combine working hours/breaks with an optional `daily_capacities` row.
 * This is the shared pure calculation used by both the single-date and
 * batched range implementations.
 */
export function buildCapacityResult(
  date: string,
  workingRanges: TimeRange[],
  breakRanges: TimeRange[],
  capacityRow?: { configured_capacity: number | null; registered_count: number | null } | null
): CapacityCalculationResult {
  if (workingRanges.length === 0) {
    return emptyCapacityResult(date);
  }

  const availableRanges = subtractBreaks(workingRanges, breakRanges);
  const totalAvailableMinutes = calculateTotalMinutes(availableRanges);
  const calculated_capacity = Math.floor(totalAvailableMinutes / CONSULTATION_DURATION_MINUTES);

  const configured_capacity = capacityRow?.configured_capacity ?? null;
  const registered_count = capacityRow?.registered_count ?? 0;

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
 * Calculate capacity when the caller already has the schedule context.
 * Only the `daily_capacities` row is fetched.
 */
export async function calculateCapacityWithContext(
  doctorId: string,
  date: string,
  context: CapacityContext
): Promise<CapacityCalculationResult> {
  if (context.hasUnavailability || context.workingRanges.length === 0) {
    return emptyCapacityResult(date);
  }

  const existingCapacityResult = await query(
    `SELECT configured_capacity, registered_count FROM daily_capacities
     WHERE doctor_id = $1 AND date = $2`,
    [doctorId, date]
  );

  return buildCapacityResult(
    date,
    context.workingRanges,
    context.breakRanges,
    existingCapacityResult.rows[0] || null
  );
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

  // The three schedule lookups are independent, so run them together.
  const [unavailabilityResult, schedulesResult, breaksResult] = await Promise.all([
    query(
      `SELECT 1 FROM doctor_unavailability
       WHERE doctor_id = $1 AND is_active = true
       AND start_date <= $2 AND end_date >= $2
       LIMIT 1`,
      [doctorId, date]
    ),
    query(
      `SELECT start_time, end_time FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true
       ORDER BY start_time`,
      [doctorId, dayOfWeek]
    ),
    query(
      `SELECT start_time, end_time FROM doctor_break_periods
       WHERE doctor_id = $1 AND break_date = $2 AND is_active = true
       ORDER BY start_time`,
      [doctorId, date]
    ),
  ]);

  return calculateCapacityWithContext(doctorId, date, {
    hasUnavailability: unavailabilityResult.rows.length > 0,
    workingRanges: schedulesResult.rows.map(row => ({
      start: row.start_time,
      end: row.end_time,
    })),
    breakRanges: breaksResult.rows.map(row => ({
      start: row.start_time,
      end: row.end_time,
    })),
  });
}

function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).split('T')[0];
}

/**
 * Calculate capacity for a date range using four batched queries instead of
 * four queries per date (the previous N+1 behaviour).
 */
export async function calculateCapacityRange(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, CapacityCalculationResult>> {
  const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);

  const dateRange: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    dateRange.push(`${yearStr}-${monthStr}-${dayStr}`);
  }

  const dayOfWeekArray = Array.from(new Set(dateRange.map(d => new Date(d).getDay())));

  const [unavailabilityResult, schedulesResult, breaksResult, capacityResult] = await Promise.all([
    query(
      `SELECT start_date, end_date FROM doctor_unavailability
       WHERE doctor_id = $1 AND is_active = true
       AND start_date <= $2 AND end_date >= $3`,
      [doctorId, endDate, startDate]
    ),
    query(
      `SELECT day_of_week, start_time, end_time FROM doctor_schedules
       WHERE doctor_id = $1 AND day_of_week = ANY($2::int[]) AND is_active = true
       ORDER BY day_of_week, start_time`,
      [doctorId, dayOfWeekArray]
    ),
    query(
      `SELECT break_date, start_time, end_time FROM doctor_break_periods
       WHERE doctor_id = $1 AND break_date = ANY($2::date[]) AND is_active = true
       ORDER BY break_date, start_time`,
      [doctorId, dateRange]
    ),
    query(
      `SELECT date, configured_capacity, registered_count FROM daily_capacities
       WHERE doctor_id = $1 AND date = ANY($2::date[])`,
      [doctorId, dateRange]
    ),
  ]);

  // Expand unavailable ranges into a per-date set (ranges are inclusive).
  const unavailableDates = new Set<string>();
  unavailabilityResult.rows.forEach(row => {
    const [uYear, uMonth, uDay] = toDateString(row.start_date).split('-').map(Number);
    const [eYear2, eMonth2, eDay2] = toDateString(row.end_date).split('-').map(Number);
    const uStart = new Date(uYear, uMonth - 1, uDay);
    const uEnd = new Date(eYear2, eMonth2 - 1, eDay2);

    for (let d = new Date(uStart); d <= uEnd; d.setDate(d.getDate() + 1)) {
      unavailableDates.add(toDateString(d));
    }
  });

  const schedulesMap: Record<number, TimeRange[]> = {};
  schedulesResult.rows.forEach(row => {
    if (!schedulesMap[row.day_of_week]) {
      schedulesMap[row.day_of_week] = [];
    }
    schedulesMap[row.day_of_week].push({
      start: row.start_time,
      end: row.end_time,
    });
  });

  const breaksMap: Record<string, TimeRange[]> = {};
  breaksResult.rows.forEach(row => {
    const dateStr = toDateString(row.break_date);
    if (!breaksMap[dateStr]) {
      breaksMap[dateStr] = [];
    }
    breaksMap[dateStr].push({
      start: row.start_time,
      end: row.end_time,
    });
  });

  const capacityMap: Record<string, any> = {};
  capacityResult.rows.forEach(row => {
    capacityMap[toDateString(row.date)] = row;
  });

  const results = new Map<string, CapacityCalculationResult>();
  for (const dateStr of dateRange) {
    if (unavailableDates.has(dateStr)) {
      results.set(dateStr, emptyCapacityResult(dateStr));
      continue;
    }

    const dayOfWeek = new Date(dateStr).getDay();
    results.set(
      dateStr,
      buildCapacityResult(
        dateStr,
        schedulesMap[dayOfWeek] || [],
        breaksMap[dateStr] || [],
        capacityMap[dateStr] || null
      )
    );
  }

  return results;
}
