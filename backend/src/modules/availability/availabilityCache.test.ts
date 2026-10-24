import { calculateAvailabilityRange, invalidateAvailabilityCache } from './availabilityService';

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

describe('availability range cache', () => {
  const startDate = dateString(1);
  const endDate = dateString(2);

  beforeEach(() => {
    jest.clearAllMocks();
    invalidateAvailabilityCache();
  });

  function mockQueries() {
    query.mockImplementation((sql: string) => {
      if (sql.includes('doctor_unavailability')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('doctor_schedules')) {
        return Promise.resolve({
          rows: [
            { day_of_week: new Date(startDate).getDay(), start_time: '09:00', end_time: '11:00' },
            { day_of_week: new Date(endDate).getDay(), start_time: '09:00', end_time: '11:00' },
          ],
        });
      }
      if (sql.includes('doctor_break_periods')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('daily_capacities')) {
        return Promise.resolve({
          rows: [startDate, endDate].map(date => ({
            date,
            calculated_capacity: 4,
            configured_capacity: 4,
            final_capacity: 4,
            registered_count: 1,
          })),
        });
      }
      if (sql.includes('appointments')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  it('runs the batched queries once and reuses the cached range', async () => {
    mockQueries();

    const first = await calculateAvailabilityRange('doctor-1', startDate, endDate);
    expect(first.dates).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(5);

    const second = await calculateAvailabilityRange('doctor-1', startDate, endDate);
    expect(second.dates).toHaveLength(2);
    expect(query).toHaveBeenCalledTimes(5);
  });

  it('re-queries after the cache is invalidated', async () => {
    mockQueries();

    await calculateAvailabilityRange('doctor-1', startDate, endDate);
    expect(query).toHaveBeenCalledTimes(5);

    invalidateAvailabilityCache('doctor-1');
    await calculateAvailabilityRange('doctor-1', startDate, endDate);
    expect(query).toHaveBeenCalledTimes(10);
  });

  it('never caches patient-specific results', async () => {
    mockQueries();

    await calculateAvailabilityRange('doctor-1', startDate, endDate, 'patient-1');
    const callsAfterFirst = query.mock.calls.length;

    await calculateAvailabilityRange('doctor-1', startDate, endDate, 'patient-1');
    expect(query.mock.calls.length).toBe(callsAfterFirst * 2);
  });
});
