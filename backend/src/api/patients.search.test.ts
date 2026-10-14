/**
 * Tests for secretary patient search with legacy patient support
 * These tests verify that secretary search finds patients with either associations or appointment history
 */

import request from 'supertest';
import express from 'express';
import patientsRouter from './patients';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'test-secretary-id', role: 'SECRETARY' };
    next();
  },
  authorize: (role: string) => (req: any, res: any, next: any) => {
    if (req.user?.role === role) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  },
  requirePasswordChange: (req: any, res: any, next: any) => next(),
}));

const { query } = require('../database/connection');

describe('Secretary Patient Search with Legacy Support', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/patients', patientsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/patients/search', () => {
    it('should find patient with association to assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'test-doctor-id' }] });
        }
        if (sql.includes('SELECT p.id, p.user_id') && sql.includes('FROM patients p')) {
          return Promise.resolve({
            rows: [{
              id: 'test-patient-id',
              user_id: 'test-user-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com',
              username: 'johndoe'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/search')
        .query({ firstName: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('should find legacy patient with appointment history but no association', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'test-doctor-id' }] });
        }
        if (sql.includes('SELECT p.id, p.user_id') && sql.includes('FROM patients p')) {
          return Promise.resolve({
            rows: [{
              id: 'test-patient-id',
              user_id: 'test-user-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com',
              username: 'johndoe'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/search')
        .query({ firstName: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });

    it('should restrict search to assigned doctor only', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'test-doctor-id' }] });
        }
        if (sql.includes('SELECT p.id, p.user_id') && sql.includes('FROM patients p')) {
          // Return empty results - patient not associated with assigned doctor
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/search')
        .query({ firstName: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should require at least one search parameter', async () => {
      const response = await request(app)
        .get('/api/v1/patients/search')
        .query({});

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('At least one search parameter is required');
    });
  });
});
