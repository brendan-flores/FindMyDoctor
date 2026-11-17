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
  getClient: jest.fn(),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
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

const { query, getClient } = require('../database/connection');

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

    it('should deny patient access to another patient prescriptions (404 non-disclosing)', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'different-patient-789' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Not found');

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

    it('should deny secretaries access to prescription history', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
      expect(query).not.toHaveBeenCalled();
    });

    it('should deny secretaries access even for their assigned doctor\'s patients', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
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
      // Items are attached (empty when the mock returns no item rows)
      expect(response.body.data[0].items).toEqual([]);
    });

    it('should attach items for the doctor role', async () => {
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
      // Items are attached for the doctor (empty when the mock returns no item rows)
      expect(response.body.data[0].items).toEqual([]);
    });

    it('should reject admin role with 403', async () => {
      mockUser = { id: 'admin-user-id', role: 'ADMIN' };

      const response = await request(app)
        .get('/api/v1/prescriptions/patients/patient-123');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Forbidden');
    });
  });

  describe('POST /api/v1/prescriptions (notification and push)', () => {
    const installMocks = (options: { notificationFails?: boolean; patientLookupEmpty?: boolean } = {}) => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'doctor-456' }] });
        }
        if (sql.startsWith('SELECT * FROM visits WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: 'patient-123',
              doctor_id: 'doctor-456',
              status: 'ISSUED',
            }],
          });
        }
        if (sql.includes("FROM prescriptions WHERE visit_id = $1 AND status = 'ISSUED'")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM prescriptions') && sql.includes("status = 'VOIDED'")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.startsWith('INSERT INTO notifications')) {
          if (options.notificationFails) return Promise.reject(new Error('Database error'));
          return Promise.resolve({ rows: [] });
        }
        if (sql.startsWith('SELECT user_id FROM patients WHERE id = $1')) {
          return Promise.resolve({
            rows: options.patientLookupEmpty ? [] : [{ user_id: 'patient-user-123' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      getClient.mockImplementation(() =>
        Promise.resolve({
          query: (sql: string) => {
            if (sql.startsWith('INSERT INTO prescriptions')) {
              return Promise.resolve({
                rows: [{
                  id: 'rx-1',
                  visit_id: 'visit-1',
                  patient_id: 'patient-123',
                  doctor_id: 'doctor-456',
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          },
          release: jest.fn(),
        })
      );
    };

    it('should create notification for patient after prescription creation', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      installMocks();

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
              instructions: 'Take after meals'
            }
          ],
          notes: 'Test prescription'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify that notification was created
      const notificationCall = query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO notifications')
      );
      expect(notificationCall).toBeDefined();
      expect(notificationCall[1]).toContain('patient-user-123');
      expect(notificationCall[1]).toContain('PRESCRIPTION_AVAILABLE');
    });

    it('should create prescription even if notification creation fails', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      installMocks({ notificationFails: true });

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
              instructions: 'Take after meals'
            }
          ],
          notes: 'Test prescription'
        });

      // Prescription should still be created successfully
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should create prescription even if patient user lookup fails', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      installMocks({ patientLookupEmpty: true });

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
              instructions: 'Take after meals'
            }
          ],
          notes: 'Test prescription'
        });

      // Prescription should still be created successfully
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/prescriptions (pricing guard)', () => {
    it('should ignore pricing fields while keeping medication quantity', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'doctor-456' }] });
        }
        if (sql.startsWith('SELECT * FROM visits WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({
            rows: [{
              id: 'visit-1',
              patient_id: 'patient-123',
              doctor_id: 'doctor-456',
              status: 'ISSUED',
            }],
          });
        }
        if (sql.includes("FROM prescriptions WHERE visit_id = $1 AND status = 'ISSUED'")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('FROM prescriptions') && sql.includes("status = 'VOIDED'")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.startsWith('INSERT INTO notifications')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.startsWith('SELECT user_id FROM patients WHERE id = $1')) {
          return Promise.resolve({ rows: [{ user_id: 'patient-user-123' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const clientCalls: Array<{ sql: string; params?: any[] }> = [];
      getClient.mockImplementation(() =>
        Promise.resolve({
          query: (sql: string, params?: any[]) => {
            clientCalls.push({ sql, params });
            if (sql.startsWith('INSERT INTO prescriptions')) {
              return Promise.resolve({
                rows: [{
                  id: 'rx-1',
                  visit_id: 'visit-1',
                  patient_id: 'patient-123',
                  doctor_id: 'doctor-456',
                }],
              });
            }
            return Promise.resolve({ rows: [] });
          },
          release: jest.fn(),
        })
      );
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
              quantity: 7 // Supported medication quantity
            }
          ],
          notes: 'Test prescription'
        });

      // The endpoint should accept the request (ignoring pricing fields)
      // This regression test ensures pricing fields don't break the endpoint
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify that the prescription was created without pricing fields
      const insertPrescriptionCall = clientCalls.find((call) =>
        call.sql.includes('INSERT INTO prescriptions')
      );
      expect(insertPrescriptionCall).toBeDefined();

      // Verify that prescription items were inserted without pricing fields
      const insertItemsCall = clientCalls.find((call) =>
        call.sql.includes('INSERT INTO prescription_items')
      );
      expect(insertItemsCall).toBeDefined();
      // The SQL should NOT include unit_price, but quantity is now supported
      expect(insertItemsCall!.sql).not.toContain('unit_price');
      expect(insertItemsCall!.sql).toContain('quantity');
    });
  });
});

describe('Patient prescription visibility', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/prescriptions', prescriptionsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'patient-user-id', role: 'PATIENT' };
  });

  it('returns only issued prescriptions in the patient list', async () => {
    let capturedSql = '';
    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-1' }] });
      }
      if (sql.includes('FROM prescriptions p')) {
        capturedSql = sql;
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app).get('/api/v1/prescriptions/me');

    expect(response.status).toBe(200);
    expect(capturedSql).toContain("p.status = 'ISSUED'");
  });

  it('returns only issued prescriptions on a patient detail read', async () => {
    let capturedSql = '';
    query.mockImplementation((sql: string) => {
      capturedSql = sql;
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app).get('/api/v1/prescriptions/rx-1');

    expect(response.status).toBe(404);
    expect(capturedSql).toContain("p.status = 'ISSUED'");
  });

  it('gives secretaries no access to a prescription detail', async () => {
    mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

    const response = await request(app).get('/api/v1/prescriptions/rx-1');

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns only issued prescriptions when a patient requests a PDF link', async () => {
    let capturedSql = '';
    query.mockImplementation((sql: string) => {
      capturedSql = sql;
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');

    expect(response.status).toBe(404);
    expect(capturedSql).toContain('status = \'ISSUED\'');
  });

  it('gives secretaries no access to prescription PDF links', async () => {
    mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');

    expect(response.status).toBe(403);
  });
});
