/**
 * Tests for secretary schedule API security and authorization
 * These tests verify secretary assignment enforcement, CRUD operations,
 * and unauthorized access prevention in schedule management
 */

import request from 'supertest';
import express from 'express';
import secretariesRouter from './secretaries';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

let mockUser = { id: 'test-secretary-id', role: 'SECRETARY' };

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
}));

const { query, getClient } = require('../database/connection');

describe('Secretary Schedule API Security', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/secretaries', secretariesRouter);
    jest.clearAllMocks();
    mockUser = { id: 'test-secretary-id', role: 'SECRETARY' };
  });

  describe('GET /api/v1/secretaries/managed-doctors/schedules', () => {
    it('should return schedules for secretary\'s assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_schedules WHERE doctor_id = $1')) {
          expect(params[0]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [
              {
                id: 'schedule-1',
                doctor_id: 'assigned-doctor-id',
                day_of_week: 1,
                start_time: '08:00',
                end_time: '17:00',
                is_active: true
              }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/secretaries/managed-doctors/schedules');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].doctor_id).toBe('assigned-doctor-id');
    });

    it('should return 404 if secretary profile not found', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/secretaries/managed-doctors/schedules');

      expect(response.status).toBe(404);
    });

    it('should return 403 for non-secretary role', async () => {
      mockUser = { id: 'test-doctor-id', role: 'DOCTOR' };

      const response = await request(app)
        .get('/api/v1/secretaries/managed-doctors/schedules');

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/v1/secretaries/managed-doctors/unavailability', () => {
    it('should create exception for secretary\'s assigned doctor', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('INSERT INTO doctor_unavailability')) {
          expect(params[0]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'exception-1',
              doctor_id: 'assigned-doctor-id',
              start_date: '2024-12-01',
              end_date: '2024-12-01',
              reason: 'Test reason',
              is_active: true
            }]
          });
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/secretaries/managed-doctors/unavailability')
        .send({
          startDate: '2024-12-01',
          endDate: '2024-12-01',
          reason: 'Test reason'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.doctor_id).toBe('assigned-doctor-id');
    });

    it('should return 404 if secretary profile not found', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('ROLLBACK')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/secretaries/managed-doctors/unavailability')
        .send({
          startDate: '2024-12-01',
          endDate: '2024-12-01',
          reason: 'Test reason'
        });

      expect(response.status).toBe(404);
    });

    it('should validate start date <= end date', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('ROLLBACK')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/secretaries/managed-doctors/unavailability')
        .send({
          startDate: '2024-12-02',
          endDate: '2024-12-01',
          reason: 'Test reason'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Start date must be before or equal to end date');
    });
  });

  describe('PUT /api/v1/secretaries/managed-doctors/unavailability/:id', () => {
    it('should update exception for secretary\'s assigned doctor', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2')) {
          expect(params[1]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'exception-1',
              doctor_id: 'assigned-doctor-id',
              start_date: '2024-12-01',
              end_date: '2024-12-01',
              reason: 'Old reason'
            }]
          });
        }
        if (sql.includes('UPDATE doctor_unavailability')) {
          return Promise.resolve({
            rows: [{
              id: 'exception-1',
              doctor_id: 'assigned-doctor-id',
              start_date: '2024-12-02',
              end_date: '2024-12-02',
              reason: 'New reason'
            }]
          });
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .put('/api/v1/secretaries/managed-doctors/unavailability/exception-1')
        .send({
          startDate: '2024-12-02',
          endDate: '2024-12-02',
          reason: 'New reason'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.reason).toBe('New reason');
    });

    it('should return 404 for exception not belonging to assigned doctor', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('ROLLBACK')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .put('/api/v1/secretaries/managed-doctors/unavailability/exception-1')
        .send({
          startDate: '2024-12-02',
          endDate: '2024-12-02',
          reason: 'New reason'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/secretaries/managed-doctors/unavailability/:id', () => {
    it('should delete exception for secretary\'s assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2')) {
          expect(params[1]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'exception-1',
              doctor_id: 'assigned-doctor-id'
            }]
          });
        }
        if (sql.includes('DELETE FROM doctor_unavailability')) {
          return Promise.resolve({
            rows: [{
              id: 'exception-1',
              doctor_id: 'assigned-doctor-id'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete('/api/v1/secretaries/managed-doctors/unavailability/exception-1');

      expect(response.status).toBe(200);
    });

    it('should return 404 for exception not belonging to assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_unavailability WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete('/api/v1/secretaries/managed-doctors/unavailability/exception-1');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/secretaries/managed-doctors/break-periods', () => {
    it('should create break period for secretary\'s assigned doctor', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('INSERT INTO doctor_break_periods')) {
          expect(params[0]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'break-1',
              doctor_id: 'assigned-doctor-id',
              break_date: '2024-12-01',
              start_time: '12:00',
              end_time: '13:00',
              reason: 'Lunch',
              is_active: true
            }]
          });
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/secretaries/managed-doctors/break-periods')
        .send({
          breakDate: '2024-12-01',
          startTime: '12:00',
          endTime: '13:00',
          reason: 'Lunch'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.doctor_id).toBe('assigned-doctor-id');
    });

    it('should validate start time < end time', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('ROLLBACK')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/secretaries/managed-doctors/break-periods')
        .send({
          breakDate: '2024-12-01',
          startTime: '13:00',
          endTime: '12:00',
          reason: 'Lunch'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Start time must be before end time');
    });
  });

  describe('PUT /api/v1/secretaries/managed-doctors/break-periods/:id', () => {
    it('should update break period for secretary\'s assigned doctor', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2')) {
          expect(params[1]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'break-1',
              doctor_id: 'assigned-doctor-id',
              break_date: '2024-12-01',
              start_time: '12:00',
              end_time: '13:00',
              reason: 'Lunch'
            }]
          });
        }
        if (sql.includes('UPDATE doctor_break_periods')) {
          return Promise.resolve({
            rows: [{
              id: 'break-1',
              doctor_id: 'assigned-doctor-id',
              break_date: '2024-12-01',
              start_time: '13:00',
              end_time: '14:00',
              reason: 'Extended lunch'
            }]
          });
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .put('/api/v1/secretaries/managed-doctors/break-periods/break-1')
        .send({
          breakDate: '2024-12-01',
          startTime: '13:00',
          endTime: '14:00',
          reason: 'Extended lunch'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.reason).toBe('Extended lunch');
    });

    it('should return 404 for break period not belonging to assigned doctor', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('ROLLBACK')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .put('/api/v1/secretaries/managed-doctors/break-periods/break-1')
        .send({
          breakDate: '2024-12-01',
          startTime: '13:00',
          endTime: '14:00',
          reason: 'Extended lunch'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/secretaries/managed-doctors/break-periods/:id', () => {
    it('should delete break period for secretary\'s assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2')) {
          expect(params[1]).toBe('assigned-doctor-id');
          return Promise.resolve({
            rows: [{
              id: 'break-1',
              doctor_id: 'assigned-doctor-id'
            }]
          });
        }
        if (sql.includes('DELETE FROM doctor_break_periods')) {
          return Promise.resolve({
            rows: [{
              id: 'break-1',
              doctor_id: 'assigned-doctor-id'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete('/api/v1/secretaries/managed-doctors/break-periods/break-1');

      expect(response.status).toBe(200);
    });

    it('should return 404 for break period not belonging to assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'assigned-doctor-id' }] });
        }
        if (sql.includes('SELECT * FROM doctor_break_periods WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .delete('/api/v1/secretaries/managed-doctors/break-periods/break-1');

      expect(response.status).toBe(404);
    });
  });
});
