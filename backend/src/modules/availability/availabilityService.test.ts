/**
 * Tests for availability service
 * These tests verify that availability correctly reports dates as unavailable when no daily_capacities row exists
 */

import { calculateAvailability } from './availabilityService';

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

      const result = await calculateAvailability('doctor-1', '2026-10-25');

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

      const result = await calculateAvailability('doctor-1', '2026-10-25');

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

      const result = await calculateAvailability('doctor-1', '2026-10-25');

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

      const result = await calculateAvailability('doctor-1', '2026-10-25');

      // Should report as NON_WORKING (takes precedence)
      expect(result.status).toBe('NON_WORKING');
    });

    it('should still respect full-day unavailability even with no capacity row', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('doctor_unavailability')) {
          // Full-day unavailability configured
          return Promise.resolve({
            rows: [{ id: 1, start_date: '2026-10-25', end_date: '2026-10-25', is_active: true }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateAvailability('doctor-1', '2026-10-25');

      // Should report as UNAVAILABLE (takes precedence)
      expect(result.status).toBe('UNAVAILABLE');
    });
  });
});
