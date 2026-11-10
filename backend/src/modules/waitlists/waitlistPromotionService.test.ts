/**
 * Waitlist promotion service tests.
 *
 * When a slot becomes available the earliest WAITING entry must move to
 * OFFERED (with a 24h expiry) and the patient must receive a WAITLIST_UPDATE
 * notification.
 */

jest.mock('../../database/connection', () => ({
  getClient: jest.fn(),
}));

jest.mock('../../api/notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

import {
  promoteNextPatient,
  recalculatePositions,
} from './waitlistPromotionService';

const { getClient } = require('../../database/connection');
const { createNotification } = require('../../api/notifications');

function makeClient(handler: (sql: string, params: any[]) => any) {
  return {
    query: jest.fn((sql: string, params: any[]) => Promise.resolve(handler(sql, params) ?? { rows: [] })),
    release: jest.fn(),
  };
}

describe('promoteNextPatient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers the slot to the earliest waiting patient and notifies them', async () => {
    const waitingEntry = {
      id: 'waitlist-1',
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      waitlist_date: '2099-01-01',
      position: 1,
      status: 'WAITING',
    };

    const mockClient = makeClient((sql, params) => {
      if (sql.includes('FROM waitlists')) {
        expect(params).toEqual(['doctor-1', '2099-01-01']);
        return { rows: [waitingEntry] };
      }
      if (sql.includes("SET status = 'OFFERED'")) {
        expect(params[2]).toBe('waitlist-1');
        return { rows: [] };
      }
      if (sql.includes('SELECT user_id FROM patients')) {
        return { rows: [{ user_id: 'patient-user-1' }] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const result = await promoteNextPatient('doctor-1', '2099-01-01');

    expect(result).toMatchObject({
      id: 'waitlist-1',
      patientId: 'patient-1',
      status: 'OFFERED',
      position: 1,
    });
    expect(result.expiresAt.getTime()).toBeGreaterThan(result.offeredAt.getTime());

    // A 24-hour offer window: expires 24h after it was offered.
    expect(result.expiresAt.getTime() - result.offeredAt.getTime()).toBe(24 * 60 * 60 * 1000);

    expect(createNotification).toHaveBeenCalledWith(
      'patient-user-1',
      'WAITLIST_UPDATE',
      expect.any(String),
      expect.any(String),
      'waitlist',
      'waitlist-1'
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns null and rolls back when nobody is waiting', async () => {
    const mockClient = makeClient((sql) => {
      if (sql.includes('FROM waitlists')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const result = await promoteNextPatient('doctor-1', '2099-01-01');

    expect(result).toBeNull();
    expect(createNotification).not.toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rolls back and rethrows when notification delivery fails', async () => {
    const mockClient = makeClient((sql) => {
      if (sql.includes('FROM waitlists')) {
        return {
          rows: [
            {
              id: 'waitlist-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              waitlist_date: '2099-01-01',
              position: 1,
              status: 'WAITING',
            },
          ],
        };
      }
      if (sql.includes('SELECT user_id FROM patients')) {
        return { rows: [{ user_id: 'patient-user-1' }] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);
    createNotification.mockRejectedValueOnce(new Error('notification down'));

    await expect(promoteNextPatient('doctor-1', '2099-01-01')).rejects.toThrow('notification down');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});

describe('recalculatePositions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renumbers WAITING entries in creation order', async () => {
    const mockClient = makeClient(() => ({ rows: [] }));
    getClient.mockResolvedValue(mockClient);

    await recalculatePositions('doctor-1', '2099-01-01');

    const sql = mockClient.query.mock.calls[0][0] as string;
    expect(sql).toContain('ROW_NUMBER() OVER (ORDER BY created_at ASC)');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
