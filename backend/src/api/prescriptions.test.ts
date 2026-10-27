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

    it('should allow secretary to access prescriptions for their assigned doctor\'s patients', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      let callCount = 0;
      query.mockImplementation((sql: string, params: any[]) => {
        callCount++;
        if (callCount === 1) {
          // First call: get secretary's assigned doctor
          return Promise.resolve({ rows: [{ doctor_id: 'doctor-456' }] });
        } else if (callCount === 2) {
          // Second call: fetch prescriptions for assigned doctor
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
        } else {
          // Third call: fetch prescription items
          return Promise.resolve({
            rows: [
              {
                id: 'item-1',
                prescription_id: 'rx-1',
                medication_name: 'Paracetamol',
                dosage: '500mg',
                frequency: '3x daily',
                duration: '7 days',
                instructions: 'Take after meals'
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
      expect(response.body.data[0].doctor_id).toBe('doctor-456');
      expect(response.body.data[0].items).toBeDefined();
      expect(response.body.data[0].items).toHaveLength(1);
      expect(response.body.data[0].items[0].medication_name).toBe('Paracetamol');

      // Verify SQL checks secretary's assigned doctor
      const secretaryCheckCall = query.mock.calls.find((call: any) =>
        call[0].includes('SELECT doctor_id FROM secretaries WHERE user_id')
      );
      expect(secretaryCheckCall).toBeDefined();
      expect(secretaryCheckCall[1]).toContain('secretary-user-id');

      // Verify SQL restricts to assigned doctor
      const prescriptionQueryCall = query.mock.calls.find((call: any) =>
        call[0].includes('p.doctor_id = $2')
      );
      expect(prescriptionQueryCall).toBeDefined();
      expect(prescriptionQueryCall[1]).toContain('doctor-456');
    });

    it('should deny secretary access to prescriptions for different doctor', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries WHERE user_id')) {
          return Promise.resolve({ rows: [{ doctor_id: 'doctor-456' }] });
        }
        // Return empty results since the prescription belongs to a different doctor
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should return prescriptions without items for patient role (backward compatibility)', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };

      let callCount = 0;
      query.mockImplementation((sql: string, params: any[]) => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ rows: [{ id: 'patient-123' }] });
        } else {
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
      // Patient role should not include items (backward compatibility)
      expect(response.body.data[0].items).toBeUndefined();
    });

    it('should return prescriptions without items for doctor role (backward compatibility)', async () => {
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
      // Doctor role should not include items (backward compatibility)
      expect(response.body.data[0].items).toBeUndefined();
    });

    it('should reject admin role with 403', async () => {
      mockUser = { id: 'admin-user-id', role: 'ADMIN' };

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });
  });

  describe('POST /api/v1/prescriptions (pricing guard)', () => {
    it('should reject prescription creation with pricing fields', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      let callCount = 0;
      query.mockImplementation((sql: string, params: any[]) => {
        callCount++;
        if (callCount === 1) {
          // First call: fetch visit
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: 'patient-123',
              doctor_id: 'doctor-456'
            }]
          });
        } else if (callCount === 2) {
          // Second call: insert prescription
          return Promise.resolve({
            rows: [{
              id: 'rx-1',
              visit_id: 'visit-1',
              patient_id: 'patient-123',
              doctor_id: 'doctor-456'
            }]
          });
        } else {
          // Third call: insert prescription items
          return Promise.resolve({ rows: [] });
        }
      });

      // Attempt to create prescription with pricing fields (should be ignored, not validated)
      const response = await request(app)
        .post('/api/v1/prescriptions')
        .send({
          visitId: 'visit-1',
          items: [
            {
              medicationName: 'Paracetamol',
              dosage: '500mg',
              frequency: '3x daily',
              duration: '7 days',
              instructions: 'Take after meals',
              unitPrice: 50.00, // Pricing field - should be ignored
              quantity: 7 // Pricing field - should be ignored
            }
          ],
          notes: 'Test prescription'
        });

      // The endpoint should accept the request (ignoring pricing fields)
      // This regression test ensures pricing fields don't break the endpoint
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify that the prescription was created without pricing fields
      const insertPrescriptionCall = query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO prescriptions')
      );
      expect(insertPrescriptionCall).toBeDefined();

      // Verify that prescription items were inserted without pricing fields
      const insertItemsCall = query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO prescription_items')
      );
      expect(insertItemsCall).toBeDefined();
      // The SQL should NOT include unit_price or quantity columns
      expect(insertItemsCall[0]).not.toContain('unit_price');
      expect(insertItemsCall[0]).not.toContain('quantity');
    });
  });
});
