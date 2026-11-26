/**
 * Tests for availability service
 * These tests verify that availability correctly reports dates as unavailable when no daily_capacities row exists
 * and handles null date values safely
 */

import { calculateAvailability, calculateAvailabilityRange } from './availabilityService';

// Mock dependencies
jest.mock('../../database/connection', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/connection');

describe('Availability Service - Missing Capacity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAvailability with missing daily_capacities row', () => {
    it('should report date as UNAVAILABLE when no daily_capacities row exists', async () => {
      // Mock query responses
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          // Return working hours (so date would otherwise be available)
          return Promise.resolve({
            rows: [{ start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          // No daily_capacities row exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01');

      // Should report as UNAVAILABLE since no capacity is configured
      expect(result.status).toBe('UNAVAILABLE');
      expect(result.capacity.configured).toBeNull();
      expect(result.capacity.final).toBe(0);
      expect(result.capacity.remaining).toBe(0);
    });

    it('should report date as AVAILABLE when daily_capacities row exists with remaining capacity', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          // Daily capacities row exists with remaining capacity
          return Promise.resolve({
            rows: [{
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 5
            }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01');

      // Should report as AVAILABLE with configured capacity
      expect(result.status).toBe('AVAILABLE');
      expect(result.capacity.configured).toBe(10);
      expect(result.capacity.final).toBe(10);
      expect(result.capacity.registered).toBe(5);
      expect(result.capacity.remaining).toBe(5);
    });

    it('should report date as FULL when daily_capacities row exists but capacity is full', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          // Daily capacities row exists but full
          return Promise.resolve({
            rows: [{
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 10
            }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01');

      // Should report as FULL
      expect(result.status).toBe('FULL');
      expect(result.capacity.configured).toBe(10);
      expect(result.capacity.final).toBe(10);
      expect(result.capacity.registered).toBe(10);
      expect(result.capacity.remaining).toBe(0);
    });

    it('should still respect other unavailability conditions (NON_WORKING) even with no capacity row', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          // No working hours configured
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01');

      // Should report as NON_WORKING (takes precedence)
      expect(result.status).toBe('NON_WORKING');
    });

    it('should still respect full-day unavailability even with no capacity row', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          // Full-day unavailability configured
          return Promise.resolve({
            rows: [{ id: 1, start_date: '2026-12-01', end_date: '2026-12-01', is_active: true }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01');

      // Should report as UNAVAILABLE (takes precedence)
      expect(result.status).toBe('UNAVAILABLE');
    });
  });

  describe('calculateAvailabilityRange with null date values', () => {
    it('should handle null dates in doctor_unavailability records without throwing', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          // Return a record with null start_date (data integrity issue)
          return Promise.resolve({
            rows: [{ start_date: null, end_date: '2026-10-25', is_active: true }]
          });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              date: '2026-10-27',
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 0
            }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Should not throw despite null date in unavailability
      const result = await calculateAvailabilityRange('doctor-1', '2026-10-27', '2026-10-27');
      expect(result).toBeDefined();
      expect(result.dates).toHaveLength(1);
    });

    it('should handle null dates in doctor_break_periods records without throwing', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          // Return a record with null break_date (data integrity issue)
          return Promise.resolve({
            rows: [{ break_date: null, start_time: '12:00', end_time: '13:00', is_active: true }]
          });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              date: '2026-10-27',
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 0
            }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Should not throw despite null date in break periods
      const result = await calculateAvailabilityRange('doctor-1', '2026-10-27', '2026-10-27');
      expect(result).toBeDefined();
      expect(result.dates).toHaveLength(1);
    });

    it('should handle null dates in daily_capacities records without throwing', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          // Return a record with null date (data integrity issue)
          return Promise.resolve({
            rows: [{ date: null, calculated_capacity: 16, configured_capacity: 10, final_capacity: 10, registered_count: 0 }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Should not throw despite null date in capacities - should treat as unavailable
      // 2026-12-07 is a Monday (day_of_week 1)
      const result = await calculateAvailabilityRange('doctor-1', '2026-12-07', '2026-12-07');
      expect(result).toBeDefined();
      expect(result.dates).toHaveLength(1);
      // Date without capacity should be UNAVAILABLE
      expect(result.dates[0].status).toBe('UNAVAILABLE');
    });

    it('should handle null dates in appointment records without throwing', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              date: '2026-10-27',
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 0
            }]
          });
        }
        if (sql.includes('appointments')) {
          // Return a record with null date (data integrity issue)
          return Promise.resolve({
            rows: [{ date: null, start_minutes: 540, end_minutes: 570 }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // Should not throw despite null date in appointments
      const result = await calculateAvailabilityRange('doctor-1', '2026-10-27', '2026-10-27');
      expect(result).toBeDefined();
      expect(result.dates).toHaveLength(1);
    });

    it('should handle Date objects in doctor_unavailability records without throwing', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          // Return Date objects (as pg driver may return them)
          // Use a future date: 2026-12-07 is a Monday
          return Promise.resolve({
            rows: [{
              start_date: new Date('2026-12-07T00:00:00Z'),
              end_date: new Date('2026-12-07T23:59:59Z'),
              is_active: true
            }]
          });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              date: '2026-12-07',
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 0
            }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      // Should not throw despite Date objects in unavailability
      const result = await calculateAvailabilityRange('doctor-1', '2026-12-07', '2026-12-07');
      expect(result).toBeDefined();
      expect(result.dates).toHaveLength(1);
      // The date should be marked as UNAVAILABLE due to unavailability record
      expect(result.dates[0].status).toBe('UNAVAILABLE');
    });
  });
});

describe('Availability Service - Exclude Appointment ID', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAvailability with excludeAppointmentId', () => {
    it('should exclude the specified appointment from conflict check', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 5
            }]
          });
        }
        if (sql.includes('appointments') && sql.includes('uuid') && params.length === 4 && params[3] === 'apt-123') {
          // When excluding apt-123, the existing appointment should not be returned
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments')) {
          // Without exclusion, existing appointment is found
          return Promise.resolve({
            rows: [{ id: 'apt-123' }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // Without exclusion - should be ALREADY_BOOKED
      const resultWithoutExclusion = await calculateAvailability('doctor-1', '2026-12-01', 'patient-1');
      expect(resultWithoutExclusion.status).toBe('ALREADY_BOOKED');

      // With exclusion - should be AVAILABLE
      const resultWithExclusion = await calculateAvailability('doctor-1', '2026-12-01', 'patient-1', 'apt-123');
      expect(resultWithExclusion.status).toBe('AVAILABLE');
    });

    it('should still mark date as ALREADY_BOOKED when another appointment exists on the same date', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 5
            }]
          });
        }
        if (sql.includes('appointments')) {
          // Even with exclusion, another appointment exists
          return Promise.resolve({
            rows: [{ id: 'apt-456' }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01', 'patient-1', 'apt-123');
      expect(result.status).toBe('ALREADY_BOOKED');
    });

    it('should not affect results when excludeAppointmentId is null', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 5
            }]
          });
        }
        if (sql.includes('appointments')) {
          return Promise.resolve({
            rows: [{ id: 'apt-123' }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-12-01', 'patient-1', null);
      expect(result.status).toBe('ALREADY_BOOKED');
    });
  });

  describe('calculateAvailabilityRange with excludeAppointmentId', () => {
    it('should exclude the specified appointment from conflict check in date range', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: 1, start_time: '09:00', end_time: '17:00' }]
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{
              date: '2026-12-07',
              calculated_capacity: 16,
              configured_capacity: 10,
              final_capacity: 10,
              registered_count: 5
            }]
          });
        }
        if (sql.includes('appointments') && sql.includes('ANY') && sql.includes('uuid') && params.length === 4 && params[3] === 'apt-123') {
          // Batch query for existing appointments with exclusion - should return empty
          return Promise.resolve({
            rows: []
          });
        }
        if (sql.includes('appointments') && sql.includes('ANY')) {
          // Batch query for existing appointments without exclusion
          return Promise.resolve({
            rows: [{ date: '2026-12-07' }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      // Without exclusion - should be ALREADY_BOOKED
      const resultWithoutExclusion = await calculateAvailabilityRange('doctor-1', '2026-12-07', '2026-12-07', 'patient-1');
      expect(resultWithoutExclusion.dates[0].status).toBe('ALREADY_BOOKED');

      // With exclusion - should be AVAILABLE
      const resultWithExclusion = await calculateAvailabilityRange('doctor-1', '2026-12-07', '2026-12-07', 'patient-1', 'apt-123');
      expect(resultWithExclusion.dates[0].status).toBe('AVAILABLE');
    });
  });
});
