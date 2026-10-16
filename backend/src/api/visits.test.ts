/**
 * Tests for visit API with doctor authorization
 * These tests verify that doctors can only access visit history for their associated patients
 */

import request from 'supertest';
import express from 'express';
import visitsRouter from './visits';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
}));

let mockUser = { id: 'test-user-id', role: 'DOCTOR' };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = mockUser;
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

describe('Visit API Authorization', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/visits', visitsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
  });

  describe('GET /api/v1/visits/patient/:patientId', () => {
    it('should allow doctor to access visits for patient through association', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v') && sql.includes('EXISTS')) {
          expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 'doctor-user-id']);
          expect(sql).toContain('SELECT id FROM doctors WHERE user_id = $2');
          expect(sql).toContain('patient_doctor_associations');
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: '550e8400-e29b-41d4-a716-446655440000',
              doctor_id: 'doctor-id',
              visit_date: '2024-01-15T10:00:00Z',
              reason_for_visit: 'Checkup',
              diagnosis: 'Flu',
              notes: 'Patient has flu symptoms'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('visit-1');
    });

    it('should allow doctor to access visits for patient through appointment', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v') && sql.includes('EXISTS')) {
          expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 'doctor-user-id']);
          expect(sql).toContain('SELECT id FROM doctors WHERE user_id = $2');
          expect(sql).toContain('appointments');
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: '550e8400-e29b-41d4-a716-446655440000',
              doctor_id: 'doctor-id',
              visit_date: '2024-01-15T10:00:00Z',
              reason_for_visit: 'Checkup'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should deny doctor access to unrelated patient visits (empty result)', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v') && sql.includes('EXISTS')) {
          expect(params).toEqual(['unrelated-patient', 'doctor-user-id']);
          // No association or appointment, so empty result
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/unrelated-patient');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should reject non-doctor roles with 403', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(403);
      expect(query).not.toHaveBeenCalled();
    });

    it('should order visits by visit_date DESC', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v')) {
          expect(sql).toContain('ORDER BY v.visit_date DESC');
          return Promise.resolve({
            rows: [
              {
                id: 'visit-2',
                patient_id: '550e8400-e29b-41d4-a716-446655440000',
                doctor_id: 'doctor-id',
                visit_date: '2024-02-15T10:00:00Z',
                reason_for_visit: 'Follow-up'
              },
              {
                id: 'visit-1',
                patient_id: '550e8400-e29b-41d4-a716-446655440000',
                doctor_id: 'doctor-id',
                visit_date: '2024-01-15T10:00:00Z',
                reason_for_visit: 'Checkup'
              }
            ]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('visit-2'); // Most recent first
      expect(response.body.data[1].id).toBe('visit-1');
    });

    it('should include appointment_date when visit has appointment', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v')) {
          expect(sql).toContain('LEFT JOIN appointments a ON v.appointment_id = a.id');
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: '550e8400-e29b-41d4-a716-446655440000',
              doctor_id: 'doctor-id',
              visit_date: '2024-01-15T10:00:00Z',
              appointment_date: '2024-01-15T09:00:00Z',
              reason_for_visit: 'Checkup'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data[0].appointment_date).toBe('2024-01-15T09:00:00Z');
    });

    it('should include doctor name from doctors table', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v')) {
          expect(sql).toContain('LEFT JOIN doctors d ON v.doctor_id = d.id');
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: '550e8400-e29b-41d4-a716-446655440000',
              doctor_id: 'doctor-id',
              visit_date: '2024-01-15T10:00:00Z',
              doctor_first_name: 'John',
              doctor_last_name: 'Smith',
              reason_for_visit: 'Checkup'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data[0].doctor_first_name).toBe('John');
      expect(response.body.data[0].doctor_last_name).toBe('Smith');
    });

    it('should return empty array for patient with no visits', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM visits v')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/visits/patient/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });
  });
});
