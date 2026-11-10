/**
 * Waitlist API tests.
 *
 * Covers join (FULL-only guard, duplicate guard), listing, status check, count,
 * read, leave (with queue-position renumbering) and role authorization.
 */

import request from 'supertest';
import express from 'express';
import waitlistsRouter from './waitlists';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../modules/availability/availabilityService', () => ({
  calculateAvailability: jest.fn(),
}));

let mockUser: any = { id: 'patient-user-1', role: 'PATIENT', mustChangePassword: false };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    }
  },
  requirePasswordChange: (_req: any, _res: any, next: any) => next(),
}));

const { query, getClient } = require('../database/connection');
const { calculateAvailability } = require('../modules/availability/availabilityService');

const FUTURE_DATE = '2099-01-01';

function makeClient(handler: (sql: string, params: any[]) => any) {
  return {
    query: jest.fn((sql: string, params: any[]) => Promise.resolve(handler(sql, params) ?? { rows: [] })),
    release: jest.fn(),
  };
}

describe('Waitlist API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/waitlists', waitlistsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'patient-user-1', role: 'PATIENT', mustChangePassword: false };
  });

  describe('POST /api/v1/waitlists (join)', () => {
    it('joins a FULL day and returns the assigned position', async () => {
      calculateAvailability.mockResolvedValue({ status: 'FULL' });

      const mockClient = makeClient((sql) => {
        if (sql.includes('SELECT id FROM patients WHERE user_id')) {
          return { rows: [{ id: 'patient-1' }] };
        }
        if (sql.includes('SELECT * FROM doctors WHERE id = $1 AND is_approved = true')) {
          return { rows: [{ id: 'doctor-1' }] };
        }
        if (sql.includes('status IN (\'WAITING\', \'OFFERED\')')) {
          return { rows: [] };
        }
        if (sql.includes('COALESCE(MAX(position)')) {
          return { rows: [{ next_position: 3 }] };
        }
        if (sql.includes('INSERT INTO waitlists')) {
          return { rows: [{ id: 'waitlist-1', position: 3 }] };
        }
        return { rows: [] };
      });
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/waitlists')
        .send({ doctorId: 'doctor-1', waitlistDate: FUTURE_DATE });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({ waitlistId: 'waitlist-1', position: 3 });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('rejects joining when slots are still available', async () => {
      calculateAvailability.mockResolvedValue({ status: 'AVAILABLE' });

      const mockClient = makeClient((sql) => {
        if (sql.includes('SELECT id FROM patients WHERE user_id')) {
          return { rows: [{ id: 'patient-1' }] };
        }
        if (sql.includes('SELECT * FROM doctors')) {
          return { rows: [{ id: 'doctor-1' }] };
        }
        return { rows: [] };
      });
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/waitlists')
        .send({ doctorId: 'doctor-1', waitlistDate: FUTURE_DATE });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('slots are still available');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('rejects a duplicate active entry with 409', async () => {
      calculateAvailability.mockResolvedValue({ status: 'FULL' });

      const mockClient = makeClient((sql) => {
        if (sql.includes('SELECT id FROM patients WHERE user_id')) {
          return { rows: [{ id: 'patient-1' }] };
        }
        if (sql.includes('SELECT * FROM doctors')) {
          return { rows: [{ id: 'doctor-1' }] };
        }
        if (sql.includes('status IN (\'WAITING\', \'OFFERED\')')) {
          return { rows: [{ id: 'existing-waitlist' }] };
        }
        return { rows: [] };
      });
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/waitlists')
        .send({ doctorId: 'doctor-1', waitlistDate: FUTURE_DATE });

      expect(response.status).toBe(409);
    });

    it('rejects joining a past date', async () => {
      const mockClient = makeClient((sql) => {
        if (sql.includes('SELECT id FROM patients WHERE user_id')) {
          return { rows: [{ id: 'patient-1' }] };
        }
        if (sql.includes('SELECT * FROM doctors')) {
          return { rows: [{ id: 'doctor-1' }] };
        }
        return { rows: [] };
      });
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/waitlists')
        .send({ doctorId: 'doctor-1', waitlistDate: '2000-01-01' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('past dates');
      expect(calculateAvailability).not.toHaveBeenCalled();
    });

    it('rejects non-patient roles with 403', async () => {
      mockUser = { id: 'doctor-user-1', role: 'DOCTOR', mustChangePassword: false };

      const response = await request(app)
        .post('/api/v1/waitlists')
        .send({ doctorId: 'doctor-1', waitlistDate: FUTURE_DATE });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/waitlists/me', () => {
    it('lists the authenticated patient\'s waitlist entries', async () => {
      query.mockResolvedValue({
        rows: [
          {
            id: 'waitlist-1',
            status: 'WAITING',
            position: 1,
            doctor_first_name: 'Jane',
            doctor_last_name: 'Doe',
          },
        ],
      });

      const response = await request(app).get('/api/v1/waitlists/me');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('WAITING');
    });
  });

  describe('GET /api/v1/waitlists/check', () => {
    it('requires doctorId and waitlistDate', async () => {
      const response = await request(app).get('/api/v1/waitlists/check');
      expect(response.status).toBe(400);
    });

    it('returns null when no active entry exists', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/waitlists/check')
        .query({ doctorId: 'doctor-1', waitlistDate: FUTURE_DATE });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeNull();
    });

    it('returns the active entry when present', async () => {
      query.mockResolvedValue({ rows: [{ id: 'waitlist-1', status: 'OFFERED' }] });

      const response = await request(app)
        .get('/api/v1/waitlists/check')
        .query({ doctorId: 'doctor-1', waitlistDate: FUTURE_DATE });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('OFFERED');
    });
  });

  describe('GET /api/v1/waitlists/count', () => {
    it('returns the active waitlist count', async () => {
      query.mockResolvedValue({ rows: [{ count: '2' }] });

      const response = await request(app).get('/api/v1/waitlists/count');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe('2');
    });
  });

  describe('GET /api/v1/waitlists/:id', () => {
    it('returns the patient\'s own entry', async () => {
      query.mockResolvedValue({ rows: [{ id: 'waitlist-1', status: 'WAITING' }] });

      const response = await request(app).get('/api/v1/waitlists/waitlist-1');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('waitlist-1');
    });

    it('returns 404 for an entry the patient does not own', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/v1/waitlists/someone-elses');

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/waitlists/:id (leave)', () => {
    it('cancels the entry and renumbers the remaining waiting list', async () => {
      const mockClient = makeClient((sql) => {
        if (sql.includes('SELECT * FROM waitlists') && sql.includes('patient_id')) {
          return {
            rows: [
              {
                id: 'waitlist-1',
                status: 'WAITING',
                doctor_id: 'doctor-1',
                waitlist_date: FUTURE_DATE,
              },
            ],
          };
        }
        return { rows: [] };
      });
      getClient.mockResolvedValue(mockClient);

      const response = await request(app).delete('/api/v1/waitlists/waitlist-1');

      expect(response.status).toBe(200);
      const renumberCall = mockClient.query.mock.calls.find((call: any[]) =>
        String(call[0]).includes('ROW_NUMBER() OVER (ORDER BY created_at ASC)')
      );
      expect(renumberCall).toBeTruthy();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('returns 404 when the entry does not belong to the patient', async () => {
      const mockClient = makeClient(() => ({ rows: [] }));
      getClient.mockResolvedValue(mockClient);

      const response = await request(app).delete('/api/v1/waitlists/not-mine');

      expect(response.status).toBe(404);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('refuses to leave an inactive entry', async () => {
      const mockClient = makeClient((sql) => {
        if (sql.includes('SELECT * FROM waitlists')) {
          return {
            rows: [
              {
                id: 'waitlist-1',
                status: 'CANCELLED',
                doctor_id: 'doctor-1',
                waitlist_date: FUTURE_DATE,
              },
            ],
          };
        }
        return { rows: [] };
      });
      getClient.mockResolvedValue(mockClient);

      const response = await request(app).delete('/api/v1/waitlists/waitlist-1');

      expect(response.status).toBe(400);
    });
  });
});
