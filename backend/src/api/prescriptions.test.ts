/**
 * Tests for prescription authorization
 * These tests verify that the prescription API correctly enforces role-based access control
 */

import request from 'supertest';
import express from 'express';
import prescriptionsRouter from './prescriptions';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
}));

let mockUser = { id: 'test-user-id', role: 'PATIENT' };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...allowedRoles: string[]) => (req: any, res: any, next: any) => {
    if (allowedRoles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden' });
    }
  },
}));

const { query } = require('../database/connection');

describe('Prescription Authorization', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/prescriptions', prescriptionsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'test-user-id', role: 'PATIENT' };
  });

  describe('GET /api/v1/prescriptions/patients/:id', () => {
    it('should allow patient to access their own prescriptions', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };

      let callCount = 0;
      query.mockImplementation((sql: string, params: any[]) => {
        callCount++;
        if (callCount === 1) {
          // First call: patient ownership check
          return Promise.resolve({ rows: [{ id: 'patient-123' }] });
        } else {
          // Second call: fetch prescriptions
          return Promise.resolve({
            rows: [
              {
                id: 'rx-1',
                patient_id: 'patient-123',
                doctor_id: 'doctor-456',
                prescription_date: '2026-10-15',
                doctor_first_name: 'Jane',
                doctor_last_name: 'Smith'
              }
            ]
          });
        }
      });

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].patient_id).toBe('patient-123');

      // Verify SQL checks patient ownership
      const patientCheckCall = query.mock.calls.find((call: any) =>
        call[0].includes('SELECT id FROM patients WHERE user_id')
      );
      expect(patientCheckCall).toBeDefined();
      expect(patientCheckCall[1]).toContain('patient-user-id');
    });

    it('should deny patient access to another patient prescriptions (403)', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'different-patient-789' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Access denied');

      // Verify the ownership check happened
      const patientCheckCall = query.mock.calls.find((call: any) =>
        call[0].includes('SELECT id FROM patients WHERE user_id')
      );
      expect(patientCheckCall).toBeDefined();
      expect(patientCheckCall[1]).toContain('patient-user-id');
    });

    it('should restrict doctor results to their own records', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockResolvedValue({
        rows: [
          {
            id: 'rx-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            prescription_date: '2026-10-15',
            doctor_first_name: 'Jane',
            doctor_last_name: 'Smith'
          }
        ]
      });

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);

      // Verify SQL includes doctor_id restriction
      const queryCall = query.mock.calls[0];
      expect(queryCall[0]).toContain('p.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)');
      expect(queryCall[1]).toContain('patient-123');
      expect(queryCall[1]).toContain('doctor-user-id');
    });

    it('should return empty array for doctor when patient has no prescriptions with them', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should reject secretary role with 403', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });

    it('should reject admin role with 403', async () => {
      mockUser = { id: 'admin-user-id', role: 'ADMIN' };

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });
  });
});
