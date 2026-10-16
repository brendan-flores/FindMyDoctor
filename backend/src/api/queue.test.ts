/**
 * Tests for queue API security and authorization
 * These tests verify secretary assignment enforcement, status transitions,
 * and unauthorized access prevention in queue operations
 */

import request from 'supertest';
import express from 'express';
import queueRouter from './queue';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

let mockUser = { id: 'test-user-id', role: 'SECRETARY' };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  },
  requireSecretaryPasswordChange: (req: any, res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (req: any, res: any, next: any) => next(),
}));

const { query } = require('../database/connection');

describe('Queue API Security', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/queue', queueRouter);
    jest.clearAllMocks();
    mockUser = { id: 'test-secretary-id', role: 'SECRETARY' };
  });

  describe('GET /api/v1/queue/:date', () => {
    it('should filter queue by secretary\'s assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('FROM queue_entries q') && sql.includes('AND q.doctor_id =')) {
          expect(params[1]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'queue-1',
              patient_id: 'patient-1',
              doctor_id: 'assigned-doctor-id',
              queue_date: '2024-12-01',
              queue_number: 1,
              status: 'WAITING',
              patient_first_name: 'John',
              patient_last_name: 'Doe'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].doctor_id).toBe('assigned-doctor-id');
    });

    it('should return empty array when no queue entries exist for the date', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('FROM queue_entries q')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return 404 if secretary profile not found', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Secretary profile not found');
    });

    it('should allow doctor to optionally filter by doctorId', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM queue_entries q') && sql.includes('AND q.doctor_id =')) {
          expect(params[1]).toBe('requested-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'queue-1',
              patient_id: 'patient-1',
              doctor_id: 'requested-doctor-id',
              queue_date: '2024-12-01',
              queue_number: 1,
              status: 'WAITING'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01')
        .query({ doctorId: 'requested-doctor-id' });

      expect(response.status).toBe(200);
    });

    it('should include both ONLINE and WALK_IN registration sources', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('FROM queue_entries q')) {
          return Promise.resolve({
            rows: [
              {
                id: 'queue-1',
                patient_id: 'patient-1',
                doctor_id: 'assigned-doctor-id',
                queue_date: '2024-12-01',
                queue_number: 1,
                status: 'WAITING',
                registration_source: 'ONLINE',
                patient_first_name: 'John',
                patient_last_name: 'Doe'
              },
              {
                id: 'queue-2',
                patient_id: 'patient-2',
                doctor_id: 'assigned-doctor-id',
                queue_date: '2024-12-01',
                queue_number: 2,
                status: 'WAITING',
                registration_source: 'WALK_IN',
                patient_first_name: 'Jane',
                patient_last_name: 'Smith'
              }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].registration_source).toBe('ONLINE');
      expect(response.body.data[1].registration_source).toBe('WALK_IN');
    });

    it('should return 500 on database error', async () => {
      query.mockImplementation(() => {
        return Promise.reject(new Error('Database connection failed'));
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toContain('Failed to fetch queue');
    });

    it('should reference u.email (users table) not p.email (patients table) for patient_email', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('FROM queue_entries q')) {
          // Verify the SQL references u.email (from users table) not p.email
          expect(sql).toContain('u.email as patient_email');
          expect(sql).not.toContain('p.email as patient_email');
          return Promise.resolve({
            rows: [{
              id: 'queue-1',
              patient_id: 'patient-1',
              doctor_id: 'assigned-doctor-id',
              queue_date: '2024-12-01',
              queue_number: 1,
              status: 'WAITING',
              patient_first_name: 'John',
              patient_last_name: 'Doe',
              patient_email: 'john.doe@example.com'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/queue/2024-12-01');

      expect(response.status).toBe(200);
      expect(response.body.data[0].patient_email).toBe('john.doe@example.com');
    });
  });

  describe('POST /api/v1/queue/:date/next', () => {
    it('should use secretary\'s assigned doctor when calling next patient', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('FROM queue_entries') && sql.includes('WHERE queue_date = $1 AND doctor_id = $2')) {
          expect(params[1]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'queue-1',
              patient_id: 'patient-1',
              doctor_id: 'assigned-doctor-id',
              queue_date: '2024-12-01',
              queue_number: 1,
              status: 'WAITING'
            }]
          });
        }
        if (sql.includes('UPDATE queue_entries') && sql.includes('status = \'CALLED\'')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/queue/2024-12-01/next')
        .send({});

      expect(response.status).toBe(200);
    });

    it('should reject if secretary provides doctorId that does not match assignment', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/queue/2024-12-01/next')
        .send({ doctorId: 'different-doctor-id' });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('You can only manage queue for your assigned doctor');
    });

    it('should require doctorId for doctor role', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      const response = await request(app)
        .post('/api/v1/queue/2024-12-01/next')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Doctor ID is required');
    });
  });

  describe('PATCH /api/v1/queue/:id/status', () => {
    it('should enforce secretary\'s assigned doctor in WHERE clause', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries') && sql.includes('doctor_id = (SELECT doctor_id FROM secretaries')) {
          expect(params[1]).toBe('queue-1');
          expect(params[2]).toBe('test-secretary-id');
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .patch('/api/v1/queue/queue-1/status')
        .send({ status: 'CALLED' });

      expect(response.status).toBe(200);
    });

    it('should enforce doctor\'s user_id in WHERE clause', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries') && sql.includes('doctor_id = (SELECT id FROM doctors WHERE user_id =')) {
          expect(params[1]).toBe('queue-1');
          expect(params[2]).toBe('doctor-user-id');
          return Promise.resolve({ rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .patch('/api/v1/queue/queue-1/status')
        .send({ status: 'CALLED' });

      expect(response.status).toBe(200);
    });

    it('should return 404 when secretary tries to update another doctor\'s queue entry', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries')) {
          return Promise.resolve({ rowCount: 0 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .patch('/api/v1/queue/queue-1/status')
        .send({ status: 'CALLED' });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Queue entry not found or access denied');
    });

    it('should validate status values', async () => {
      const response = await request(app)
        .patch('/api/v1/queue/queue-1/status')
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid status');
    });
  });

  describe('POST /api/v1/queue/:id/start-checkup', () => {
    it('should return 404 when secretary tries to start checkup for another doctor\'s queue entry', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries')) {
          return Promise.resolve({ rowCount: 0 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/queue/queue-1/start-checkup')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Queue entry not found or access denied');
    });
  });

  describe('POST /api/v1/queue/:id/complete', () => {
    it('should return 404 when secretary tries to complete another doctor\'s queue entry', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries')) {
          return Promise.resolve({ rowCount: 0 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/queue/queue-1/complete')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Queue entry not found or access denied');
    });
  });

  describe('POST /api/v1/queue/:id/skip', () => {
    it('should return 404 when secretary tries to skip another doctor\'s queue entry', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries')) {
          return Promise.resolve({ rowCount: 0 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/queue/queue-1/skip')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Queue entry not found or access denied');
    });
  });

  describe('POST /api/v1/queue/:id/not-present', () => {
    it('should return 404 when secretary tries to mark another doctor\'s queue entry as not present', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('UPDATE queue_entries')) {
          return Promise.resolve({ rowCount: 0 });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/queue/queue-1/not-present')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Queue entry not found or access denied');
    });
  });
});
