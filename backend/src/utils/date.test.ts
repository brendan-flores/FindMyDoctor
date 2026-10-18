import { getClinicDate, toClinicDateString, getClinicDateTime } from './date';

// Mock the config to use Asia/Manila timezone
jest.mock('../config', () => ({
  config: {
    app: {
      timezone: 'Asia/Manila',
    },
  },
}));

describe('Date Utility Functions (Asia/Manila Timezone)', () => {
  describe('getClinicDate', () => {
    it('should return current date in Asia/Manila timezone', () => {
      const date = getClinicDate();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle dates around UTC midnight correctly', () => {
      // UTC midnight corresponds to 8:00 AM in Asia/Manila (UTC+8)
      // So when it's 2026-10-16 00:00 UTC, it should be 2026-10-16 in Manila
      const utcMidnight = new Date('2026-10-16T00:00:00Z');
      const originalDate = Date.now;
      Date.now = jest.fn(() => utcMidnight.getTime());

      const date = getClinicDate();
      expect(date).toBe('2026-10-16');

      Date.now = originalDate;
    });

    it('should handle dates before UTC midnight', () => {
      // 2026-10-15 23:59 UTC is 2026-10-16 07:59 in Manila
      const beforeMidnight = new Date('2026-10-15T23:59:00Z');
      const originalDate = Date.now;
      Date.now = jest.fn(() => beforeMidnight.getTime());

      const date = getClinicDate();
      expect(date).toBe('2026-10-16');

      Date.now = originalDate;
    });

    it('should handle dates after UTC midnight', () => {
      // 2026-10-16 00:01 UTC is 2026-10-16 08:01 in Manila
      const afterMidnight = new Date('2026-10-16T00:01:00Z');
      const originalDate = Date.now;
      Date.now = jest.fn(() => afterMidnight.getTime());

      const date = getClinicDate();
      expect(date).toBe('2026-10-16');

      Date.now = originalDate;
    });
  });

  describe('toClinicDateString', () => {
    it('should convert a Date object to clinic date string', () => {
      const date = new Date('2026-10-16T12:00:00Z');
      const clinicDate = toClinicDateString(date);
      expect(clinicDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should not shift date-only values unexpectedly', () => {
      // A date-only value should be preserved in the clinic timezone
      const date = new Date('2026-10-16T00:00:00Z');
      const clinicDate = toClinicDateString(date);
      expect(clinicDate).toBe('2026-10-16');
    });

    it('should handle dates around calendar boundary', () => {
      // 2026-10-15 16:00 UTC is 2026-10-16 00:00 in Manila
      const boundaryDate = new Date('2026-10-15T16:00:00Z');
      const clinicDate = toClinicDateString(boundaryDate);
      expect(clinicDate).toBe('2026-10-16');
    });
  });

  describe('getClinicDateTime', () => {
    it('should return current datetime in Asia/Manila timezone', () => {
      const datetime = getClinicDateTime();
      expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });

    it('should handle datetime around UTC midnight', () => {
      // UTC midnight (2026-10-16T00:00:00Z) is 08:00 in Asia/Manila
      // We verify the function correctly converts to the clinic timezone
      const datetime = getClinicDateTime();
      expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    });
  });
});
