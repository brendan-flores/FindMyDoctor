import {
  buildCapacityResult,
  calculateCapacity,
  calculateCapacityRange,
} from './capacityService';

jest.mock('../../database/connection', () => ({
  query: jest.fn(),
}));

const { query } = require('../../database/connection');

function dateString(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('capacity service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildCapacityResult', () => {
    it('subtracts breaks and applies the lower configured capacity', () => {
      const result = buildCapacityResult(
        '2026-01-05',
        [{ start: '09:00', end: '12:00' }],
        [{ start: '10:00', end: '10:30' }],
        { configured_capacity: 4, registered_count: 1 }
      );

      // 09:00-12:00 = 180 minutes, minus a 30 minute break = 150 minutes
      expect(result.calculated_capacity).toBe(5);
      expect(result.final_capacity).toBe(4);
      expect(result.remaining_capacity).toBe(3);
    });

    it('returns an empty result without working hours', () => {
      const result = buildCapacityResult('2026-01-05', [], [], null);
      expect(result.final_capacity).toBe(0);
      expect(result.remaining_capacity).toBe(0);
    });
  });

  describe('calculateCapacityRange', () => {
    it('uses four batched queries instead of four queries per date', async () => {
      const dates = [dateString(1), dateString(2), dateString(3)];

      query.mockImplementation((sql: string) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({
            rows: [{ day_of_week: new Date(dates[0]).getDay(), start_time: '09:00', end_time: '11:00' }],
          });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: dates.map(date => ({
              date,
              configured_capacity: 4,
              registered_count: 0,
            })),
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateCapacityRange('doctor-1', dates[0], dates[2]);

      expect(result.size).toBe(3);
      expect(query).toHaveBeenCalledTimes(4);
    });
  });

  describe('calculateCapacity', () => {
    it('loads schedule inputs concurrently and only queries capacity once more', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('doctor_unavailability')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('doctor_schedules')) {
          return Promise.resolve({ rows: [{ start_time: '09:00', end_time: '11:00' }] });
        }
        if (sql.includes('doctor_break_periods')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({
            rows: [{ configured_capacity: 3, registered_count: 1 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await calculateCapacity('doctor-1', dateString(1));

      expect(query).toHaveBeenCalledTimes(4);
      expect(result.calculated_capacity).toBe(4);
      expect(result.final_capacity).toBe(3);
      expect(result.remaining_capacity).toBe(2);
    });
  });
});
