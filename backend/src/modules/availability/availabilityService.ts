import { query } from '../../database/connection';

const CONSULTATION_DURATION_MINUTES = 30;

export interface TimeSlot {
  start: string; // HH:MM format
  end: string; // HH:MM format
  isAvailable: boolean;
  status: 'AVAILABLE' | 'BOOKED' | 'BREAK' | 'PAST' | 'FULL';
}

export interface DateAvailability {
  date: string;
  dayOfWeek: number;
  status: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE' | 'PAST' | 'NON_WORKING' | 'ALREADY_BOOKED';
  workingHours: { start: string; end: string }[];
  timeSlots: TimeSlot[];
  capacity: {
    calculated: number;
    configured: number | null;
    final: number;
    registered: number;
    remaining: number;
  };
}

export interface AvailabilityRange {
  startDate: string;
  endDate: string;
  dates: DateAvailability[];
}

interface TimeRange {
  start: string;
  end: string;
}

/**
 * Calculate minutes between two time strings (HH:MM format)
 */
function calculateMinutesBetween(start: string, end: string): number {
  const [startHours, startMinutes] = start.split(':').map(Number);
  const [endHours, endMinutes] = end.split(':').map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return endTotalMinutes - startTotalMinutes;
}

/**
 * Format minutes to HH:MM string
 */
function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Merge overlapping or adjacent time ranges
 */
function mergeTimeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];
  
  const sorted = [...ranges].sort((a, b) => 
    a.start.localeCompare(b.start)
  );
  
  const merged: TimeRange[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    const lastEndMinutes = calculateMinutesBetween('00:00', last.end);
    const currentStartMinutes = calculateMinutesBetween('00:00', current.start);
    
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
 * Subtract break ranges from working ranges
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
        
        if (breakEndMinutes <= segStartMinutes || breakStartMinutes >= segEndMinutes) {
          newSegments.push(segment);
        } else {
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

/**
 * Check if a time slot overlaps with any booked interval
 */
function isSlotOverlappingWithBookings(
  slotStart: number,
  slotEnd: number,
  bookedIntervals: TimeRange[]
): boolean {
  for (const booking of bookedIntervals) {
    const bookingStart = calculateMinutesBetween('00:00', booking.start);
    const bookingEnd = calculateMinutesBetween('00:00', booking.end);
    
    // Check for overlap: slot overlaps if it starts before booking ends and ends after booking starts
    if (slotStart < bookingEnd && slotEnd > bookingStart) {
      return true;
    }
  }
  return false;
}

/**
 * Generate time slots from working time ranges (including breaks)
 * Break periods are shown as visible but non-selectable slots
 */
function generateTimeSlots(
  workingRanges: TimeRange[],
  bookedIntervals: TimeRange[],
  breakRanges: TimeRange[],
  currentDate: Date,
  remainingCapacity: number
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const isToday = currentDate.toDateString() === now.toDateString();
  
  let availableSlotsCount = 0;
  
  // Generate slots for all working hours including breaks
  for (const range of workingRanges) {
    const startMinutes = calculateMinutesBetween('00:00', range.start);
    const endMinutes = calculateMinutesBetween('00:00', range.end);
    
    let currentSlotStart = startMinutes;
    
    while (currentSlotStart + CONSULTATION_DURATION_MINUTES <= endMinutes) {
      const currentSlotEnd = currentSlotStart + CONSULTATION_DURATION_MINUTES;
      const slotStartStr = formatMinutes(currentSlotStart);
      const slotEndStr = formatMinutes(currentSlotEnd);
      
      // Check if slot is in the past (only for today)
      let isPast = false;
      if (isToday) {
        const slotTime = new Date(currentDate);
        const [hours, minutes] = slotStartStr.split(':').map(Number);
        slotTime.setHours(hours, minutes, 0, 0);
        isPast = slotTime < now;
      }
      
      // Check if slot is during a break
      const slotStartMinutes = currentSlotStart;
      const slotEndMinutes = currentSlotEnd;
      let isBreak = false;
      for (const breakRange of breakRanges) {
        const breakStartMinutes = calculateMinutesBetween('00:00', breakRange.start);
        const breakEndMinutes = calculateMinutesBetween('00:00', breakRange.end);
        
        if (slotStartMinutes < breakEndMinutes && slotEndMinutes > breakStartMinutes) {
          isBreak = true;
          break;
        }
      }
      
      // Check if slot overlaps with any booked appointment
      const isBooked = isSlotOverlappingWithBookings(slotStartMinutes, slotEndMinutes, bookedIntervals);
      
      // Check if capacity allows this slot (only for non-break slots)
      const hasCapacity = isBreak ? true : availableSlotsCount < remainingCapacity;
      
      const isAvailable = !isPast && !isBreak && !isBooked && hasCapacity;
      
      if (isAvailable && !isBreak) {
        availableSlotsCount++;
      }
      
      slots.push({
        start: slotStartStr,
        end: slotEndStr,
        isAvailable,
        status: isPast ? 'PAST' : (isBreak ? 'BREAK' : (isBooked ? 'BOOKED' : (hasCapacity ? 'AVAILABLE' : 'FULL'))),
      });
      
      currentSlotStart = currentSlotEnd;
    }
  }
  
  return slots;
}

/**
 * Get booked appointment intervals for a doctor on a specific date
 * Returns array of {start, end} for overlapping interval checking
 */
async function getBookedIntervals(doctorId: string, date: string): Promise<TimeRange[]> {
  const result = await query(
    `SELECT 
       EXTRACT(HOUR FROM appointment_date) * 60 + EXTRACT(MINUTE FROM appointment_date) as start_minutes,
       EXTRACT(HOUR FROM appointment_date + (CONSULTATION_DURATION_MINUTES || ' minutes')::interval) * 60 + 
       EXTRACT(MINUTE FROM appointment_date + (CONSULTATION_DURATION_MINUTES || ' minutes')::interval) as end_minutes
     FROM appointments
     CROSS JOIN (SELECT 30 as CONSULTATION_DURATION_MINUTES) as duration
     WHERE doctor_id = $1
     AND DATE(appointment_date) = $2
     AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
     ORDER BY appointment_date`,
    [doctorId, date]
  );
  
  return result.rows.map(row => ({
    start: formatMinutes(row.start_minutes),
    end: formatMinutes(row.end_minutes),
  }));
}

/**
 * Calculate availability for a specific doctor and date
 */
export async function calculateAvailability(
  doctorId: string,
  date: string,
  patientId?: string | null
): Promise<DateAvailability> {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const now = new Date();
  
  // Check if date is in the past
  const isPast = dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (isPast) {
    return {
      date,
      dayOfWeek,
      status: 'PAST',
      workingHours: [],
      timeSlots: [],
      capacity: { calculated: 0, configured: null, final: 0, registered: 0, remaining: 0 },
    };
  }
  
  // Check for full-day unavailability
  const unavailabilityResult = await query(
    `SELECT * FROM doctor_unavailability
     WHERE doctor_id = $1 AND is_active = true
     AND start_date <= $2 AND end_date >= $2`,
    [doctorId, date]
  );
  
  if (unavailabilityResult.rows.length > 0) {
    return {
      date,
      dayOfWeek,
      status: 'UNAVAILABLE',
      workingHours: [],
      timeSlots: [],
      capacity: { calculated: 0, configured: null, final: 0, registered: 0, remaining: 0 },
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
    return {
      date,
      dayOfWeek,
      status: 'NON_WORKING',
      workingHours: [],
      timeSlots: [],
      capacity: { calculated: 0, configured: null, final: 0, registered: 0, remaining: 0 },
    };
  }
  
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
  
  // Get capacity information first
  const capacityResult = await query(
    `SELECT calculated_capacity, configured_capacity, final_capacity, registered_count
     FROM daily_capacities
     WHERE doctor_id = $1 AND date = $2`,
    [doctorId, date]
  );
  
  let capacity = {
    calculated: 0,
    configured: null as number | null,
    final: 0,
    registered: 0,
    remaining: 0,
  };

  if (capacityResult.rows.length > 0) {
    const row = capacityResult.rows[0];
    capacity = {
      calculated: row.calculated_capacity,
      configured: row.configured_capacity,
      final: row.final_capacity,
      registered: row.registered_count || 0,
      remaining: Math.max(0, row.final_capacity - (row.registered_count || 0)),
    };
  } else {
    // No capacity configured - report as unavailable
    // Booking requires an existing daily_capacities row, so dates without one cannot be booked
    return {
      date,
      dayOfWeek,
      status: 'UNAVAILABLE',
      workingHours: workingRanges,
      timeSlots: [],
      capacity,
    };
  }
  
  // Calculate available time after breaks
  const availableRanges = subtractBreaks(workingRanges, breakRanges);
  
  // Get booked intervals (for overlapping check)
  const bookedIntervals = await getBookedIntervals(doctorId, date);
  
  // Generate time slots with capacity limit using full working ranges (to show breaks)
  const timeSlots = generateTimeSlots(workingRanges, bookedIntervals, breakRanges, dateObj, capacity.remaining);
  
  // Determine status
  let status: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE' | 'PAST' | 'NON_WORKING' | 'ALREADY_BOOKED' = 'AVAILABLE';
  if (capacity.remaining <= 0) {
    status = 'FULL';
  }

  // Check if patient already has an appointment with this doctor on this date
  if (patientId && status === 'AVAILABLE') {
    const existingAppointmentResult = await query(
      `SELECT id FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2
       AND DATE(appointment_date) = $3
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [patientId, doctorId, date]
    );

    if (existingAppointmentResult.rows.length > 0) {
      status = 'ALREADY_BOOKED';
    }
  }

  return {
    date,
    dayOfWeek,
    status,
    workingHours: workingRanges,
    timeSlots,
    capacity,
  };
}

/**
 * Calculate availability for a date range (optimized with batched queries)
 */
export async function calculateAvailabilityRange(
  doctorId: string,
  startDate: string,
  endDate: string,
  patientId?: string | null
): Promise<AvailabilityRange> {
  const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);

  // Batch fetch all data needed for the date range
  const dateRange = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yearStr = d.getFullYear();
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    const dayStr = String(d.getDate()).padStart(2, '0');
    dateRange.push(`${yearStr}-${monthStr}-${dayStr}`);
  }

  // Batch 1: Get all unavailability for the date range
  const unavailabilityResult = await query(
    `SELECT start_date, end_date FROM doctor_unavailability
     WHERE doctor_id = $1 AND is_active = true
     AND start_date <= $2 AND end_date >= $3`,
    [doctorId, endDate, startDate]
  );

  // Batch 2: Get all schedules for all days of week in range
  const dayOfWeekSet = new Set(dateRange.map(d => new Date(d).getDay()));
  const dayOfWeekArray = Array.from(dayOfWeekSet);
  const schedulesResult = await query(
    `SELECT day_of_week, start_time, end_time FROM doctor_schedules
     WHERE doctor_id = $1 AND day_of_week = ANY($2::int[]) AND is_active = true
     ORDER BY day_of_week, start_time`,
    [doctorId, dayOfWeekArray]
  );

  // Batch 3: Get all breaks for the date range
  const breaksResult = await query(
    `SELECT break_date, start_time, end_time FROM doctor_break_periods
     WHERE doctor_id = $1 AND break_date = ANY($2::date[]) AND is_active = true
     ORDER BY break_date, start_time`,
    [doctorId, dateRange]
  );

  // Batch 4: Get all capacities for the date range
  const capacityResult = await query(
    `SELECT date, calculated_capacity, configured_capacity, final_capacity, registered_count
     FROM daily_capacities
     WHERE doctor_id = $1 AND date = ANY($2::date[])`,
    [doctorId, dateRange]
  );

  // Batch 5: Get all booked appointments for the date range
  const bookedResult = await query(
    `SELECT 
       DATE(appointment_date) as date,
       EXTRACT(HOUR FROM appointment_date) * 60 + EXTRACT(MINUTE FROM appointment_date) as start_minutes,
       EXTRACT(HOUR FROM appointment_date + (CONSULTATION_DURATION_MINUTES || ' minutes')::interval) * 60 + 
       EXTRACT(MINUTE FROM appointment_date + (CONSULTATION_DURATION_MINUTES || ' minutes')::interval) as end_minutes
     FROM appointments
     CROSS JOIN (SELECT 30 as CONSULTATION_DURATION_MINUTES) as duration
     WHERE doctor_id = $1
     AND DATE(appointment_date) = ANY($2::date[])
     AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
     ORDER BY appointment_date`,
    [doctorId, dateRange]
  );

  // Batch 6: Check for existing patient appointments (if patientId provided)
  let existingAppointmentsMap: Record<string, boolean> = {};
  if (patientId) {
    const existingResult = await query(
      `SELECT DATE(appointment_date) as date
       FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2
       AND DATE(appointment_date) = ANY($3::date[])
       AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
      [patientId, doctorId, dateRange]
    );
    existingResult.rows.forEach(row => {
      let dateStr: string;
      if (row.date instanceof Date) {
        const year = row.date.getFullYear();
        const month = String(row.date.getMonth() + 1).padStart(2, '0');
        const day = String(row.date.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else {
        dateStr = String(row.date).split('T')[0];
      }
      existingAppointmentsMap[dateStr] = true;
    });
  }

  // Process data into maps for fast lookup
  const unavailabilityMap: Record<string, boolean> = {};
  unavailabilityResult.rows.forEach(row => {
    const [uYear, uMonth, uDay] = row.start_date.split('-').map(Number);
    const [eYear, eMonth, eDay] = row.end_date.split('-').map(Number);
    const uStart = new Date(uYear, uMonth - 1, uDay);
    const uEnd = new Date(eYear, eMonth - 1, eDay);
    
    for (let d = new Date(uStart); d <= uEnd; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      unavailabilityMap[dStr] = true;
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
    let dateStr: string;
    if (row.break_date instanceof Date) {
      const year = row.break_date.getFullYear();
      const month = String(row.break_date.getMonth() + 1).padStart(2, '0');
      const day = String(row.break_date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(row.break_date).split('T')[0];
    }
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
    // Convert date to string format for consistent comparison
    // Use the date portion directly from the database without timezone conversion
    let dateStr: string;
    if (row.date instanceof Date) {
      // Get the local date parts to avoid timezone issues
      const year = row.date.getFullYear();
      const month = String(row.date.getMonth() + 1).padStart(2, '0');
      const day = String(row.date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(row.date).split('T')[0];
    }
    capacityMap[dateStr] = {
      calculated: row.calculated_capacity,
      configured: row.configured_capacity,
      final: row.final_capacity,
      registered: row.registered_count || 0,
      remaining: Math.max(0, row.final_capacity - (row.registered_count || 0)),
    };
  });

  const bookedMap: Record<string, TimeRange[]> = {};
  bookedResult.rows.forEach(row => {
    let dateStr: string;
    if (row.date instanceof Date) {
      const year = row.date.getFullYear();
      const month = String(row.date.getMonth() + 1).padStart(2, '0');
      const day = String(row.date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = String(row.date).split('T')[0];
    }
    if (!bookedMap[dateStr]) {
      bookedMap[dateStr] = [];
    }
    bookedMap[dateStr].push({
      start: formatMinutes(row.start_minutes),
      end: formatMinutes(row.end_minutes),
    });
  });

  // Now calculate availability for each date using the batched data
  const results: DateAvailability[] = [];
  const now = new Date();

  for (const dateStr of dateRange) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // Check if date is in the past
    const isPast = dateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (isPast) {
      results.push({
        date: dateStr,
        dayOfWeek,
        status: 'PAST',
        workingHours: [],
        timeSlots: [],
        capacity: { calculated: 0, configured: null, final: 0, registered: 0, remaining: 0 },
      });
      continue;
    }

    // Check for full-day unavailability
    if (unavailabilityMap[dateStr]) {
      results.push({
        date: dateStr,
        dayOfWeek,
        status: 'UNAVAILABLE',
        workingHours: [],
        timeSlots: [],
        capacity: { calculated: 0, configured: null, final: 0, registered: 0, remaining: 0 },
      });
      continue;
    }

    // Get working hours for this day of week
    const workingRanges = schedulesMap[dayOfWeek] || [];

    if (workingRanges.length === 0) {
      results.push({
        date: dateStr,
        dayOfWeek,
        status: 'NON_WORKING',
        workingHours: [],
        timeSlots: [],
        capacity: { calculated: 0, configured: null, final: 0, registered: 0, remaining: 0 },
      });
      continue;
    }

    // Get break periods for this date
    const breakRanges = breaksMap[dateStr] || [];

    // Get capacity information
    const capacity = capacityMap[dateStr] || {
      calculated: 0,
      configured: null,
      final: 0,
      registered: 0,
      remaining: 0,
    };

    // If no capacity configured, mark as unavailable
    if (!capacityMap[dateStr]) {
      results.push({
        date: dateStr,
        dayOfWeek,
        status: 'UNAVAILABLE',
        workingHours: workingRanges,
        timeSlots: [],
        capacity,
      });
      continue;
    }

    // Get booked intervals
    const bookedIntervals = bookedMap[dateStr] || [];

    // Generate time slots
    const timeSlots = generateTimeSlots(workingRanges, bookedIntervals, breakRanges, dateObj, capacity.remaining);

    // Determine status
    let status: 'AVAILABLE' | 'FULL' | 'UNAVAILABLE' | 'PAST' | 'NON_WORKING' | 'ALREADY_BOOKED' = 'AVAILABLE';
    if (capacity.remaining <= 0) {
      status = 'FULL';
    }

    // Check if patient already has an appointment
    if (patientId && existingAppointmentsMap[dateStr]) {
      status = 'ALREADY_BOOKED';
    }

    results.push({
      date: dateStr,
      dayOfWeek,
      status,
      workingHours: workingRanges,
      timeSlots,
      capacity,
    });
  }

  return {
    startDate,
    endDate,
    dates: results,
  };
}
