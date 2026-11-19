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

// The PDF service is unit-tested separately. These tests only verify that the
// API enforces authorization and delegates PDF preparation correctly.
jest.mock('../services/prescriptionPdfService', () => ({
  generatePrescriptionPdfFile: jest.fn(),
  ensurePrescriptionPdf: jest.fn(),
  buildPrescriptionNumber: jest.fn(() => 'RX-TEST'),
  buildPrescriptionDownloadFileName: jest.fn((options: {
    superseded?: boolean;
    replacesPrescriptionId?: string | null;
  }) => {
    const base = 'FLORES_Beavz_RX-20261117-006B2828';
    if (options.superseded && options.replacesPrescriptionId) {
      return `${base}_replaces-41A6B551_SUPERSEDED.pdf`;
    }
    if (options.superseded) return `${base}_SUPERSEDED.pdf`;
    if (options.replacesPrescriptionId) return `${base}_replaces-41A6B551.pdf`;
    return `${base}.pdf`;
  }),
}));

jest.mock('../services/storageService', () => ({
  downloadPrescriptionPdf: jest.fn(),
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
const { ensurePrescriptionPdf, generatePrescriptionPdfFile, buildPrescriptionDownloadFileName } = require('../services/prescriptionPdfService');
const { downloadPrescriptionPdf } = require('../services/storageService');

describe('Prescription Authorization', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/prescriptions', prescriptionsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'test-user-id', role: 'PATIENT' };
  });

  describe('GET /api/v1/prescriptions/:id/download', () => {
    const pdfBytes = Buffer.from('%PDF-1.7 prescription');

    it('downloads the owned issued prescription as a PDF attachment', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };
      query.mockResolvedValue({ rows: [{
        pdf_url: 'stored-prescription.pdf',
        prescription_date: '2026-11-17',
        patient_first_name: 'Beavz',
        patient_last_name: 'Flores',
      }] });
      ensurePrescriptionPdf.mockResolvedValue({ success: true, filePath: 'stored-prescription.pdf' });
      downloadPrescriptionPdf.mockResolvedValue({ success: true, buffer: pdfBytes });

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-1/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="FLORES_Beavz_RX-20261117-006B2828.pdf"'
      );
      expect(response.body).toEqual(pdfBytes);
      expect(ensurePrescriptionPdf).toHaveBeenCalledWith('rx-1');
      expect(downloadPrescriptionPdf).toHaveBeenCalledWith('stored-prescription.pdf');
      // The filename is built from the patient row selected for this
      // prescription, never from a constant.
      expect(buildPrescriptionDownloadFileName).toHaveBeenCalledWith(expect.objectContaining({
        patientFirstName: 'Beavz',
        patientLastName: 'Flores',
      }));
      expect(query.mock.calls[0][0]).toContain('patient_id = (SELECT id FROM patients WHERE user_id = $2)');
    });

    it('uses whichever patient name the database returns for that prescription', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      query.mockResolvedValue({ rows: [{
        pdf_url: 'stored-prescription.pdf',
        prescription_date: '2026-10-20',
        patient_first_name: 'Maria',
        patient_last_name: 'Dela Cruz',
      }] });
      ensurePrescriptionPdf.mockResolvedValue({ success: true, filePath: 'stored-prescription.pdf' });
      downloadPrescriptionPdf.mockResolvedValue({ success: true, buffer: pdfBytes });

      await request(app).get('/api/v1/prescriptions/rx-1/download');

      expect(buildPrescriptionDownloadFileName).toHaveBeenCalledWith(expect.objectContaining({
        patientFirstName: 'Maria',
        patientLastName: 'Dela Cruz',
      }));
    });

    it('ignores a legacy sharing query and always uses the clinic filename', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };
      query.mockResolvedValue({ rows: [{
        pdf_url: 'stored-prescription.pdf',
        prescription_date: '2026-11-17',
        patient_first_name: 'Beavz',
        patient_last_name: 'Flores',
      }] });
      ensurePrescriptionPdf.mockResolvedValue({ success: true, filePath: 'stored-prescription.pdf' });
      downloadPrescriptionPdf.mockResolvedValue({ success: true, buffer: pdfBytes });

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-1/download?purpose=sharing');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="FLORES_Beavz_RX-20261117-006B2828.pdf"'
      );
      expect(response.headers['access-control-expose-headers']).toBe('Content-Disposition');
    });

    it('adds the original prescription number to a replacement filename', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      query.mockResolvedValue({ rows: [{
        pdf_url: 'stored-prescription.pdf',
        prescription_date: '2026-11-17',
        patient_first_name: 'Beavz',
        patient_last_name: 'Flores',
        replaces_prescription_id: '41a6b551-aaaa-bbbb-cccc-dddddddddddd',
        replaces_original_date: '2026-11-10',
        is_superseded: false,
      }] });
      ensurePrescriptionPdf.mockResolvedValue({ success: true, filePath: 'stored-prescription.pdf' });
      downloadPrescriptionPdf.mockResolvedValue({ success: true, buffer: pdfBytes });

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-1/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="FLORES_Beavz_RX-20261117-006B2828_replaces-41A6B551.pdf"'
      );
      expect(buildPrescriptionDownloadFileName).toHaveBeenCalledWith(expect.objectContaining({
        replacesPrescriptionId: '41a6b551-aaaa-bbbb-cccc-dddddddddddd',
        replacesPrescriptionDate: '2026-11-10',
        superseded: false,
      }));
    });

    it('marks a replaced prescription as superseded', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      query.mockResolvedValue({ rows: [{
        pdf_url: 'stored-prescription.pdf',
        prescription_date: '2026-11-17',
        patient_first_name: 'Beavz',
        patient_last_name: 'Flores',
        replaces_prescription_id: null,
        replaces_original_date: null,
        is_superseded: true,
      }] });
      ensurePrescriptionPdf.mockResolvedValue({ success: true, filePath: 'stored-prescription.pdf' });
      downloadPrescriptionPdf.mockResolvedValue({ success: true, buffer: pdfBytes });

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-1/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="FLORES_Beavz_RX-20261117-006B2828_SUPERSEDED.pdf"'
      );
      expect(buildPrescriptionDownloadFileName).toHaveBeenCalledWith(expect.objectContaining({
        superseded: true,
      }));
    });

    it('does not download a prescription that is not owned by the patient', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-other/download');

      expect(response.status).toBe(404);
      expect(ensurePrescriptionPdf).not.toHaveBeenCalled();
      expect(downloadPrescriptionPdf).not.toHaveBeenCalled();
    });

    it('restricts doctor downloads to the doctor’s own prescriptions', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-other/download');

      expect(response.status).toBe(404);
      expect(query.mock.calls[0][0]).toContain('doctor_id = (SELECT id FROM doctors WHERE user_id = $2)');
      expect(downloadPrescriptionPdf).not.toHaveBeenCalled();
    });

    it('rejects roles that are not authorized to download prescriptions', async () => {
      mockUser = { id: 'admin-user-id', role: 'ADMIN' };

      const response = await request(app)
        .get('/api/v1/prescriptions/rx-1/download');

      expect(response.status).toBe(403);
      expect(query).not.toHaveBeenCalled();
    });
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

  it('prepares a fresh download link for a legacy stored PDF', async () => {
    query.mockResolvedValue({
      rows: [{ pdf_url: 'prescription_rx-1_99999999-8888-7777-6666-555555555555.pdf' }],
    });
    ensurePrescriptionPdf.mockResolvedValueOnce({
      success: true,
      signedUrl: 'https://storage.example.com/rebuilt.pdf',
    });

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');

    expect(response.status).toBe(200);
    expect(response.body.data.signedUrl).toBe('https://storage.example.com/rebuilt.pdf');
    expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
    expect(response.headers['pragma']).toBe('no-cache');
    expect(response.headers['expires']).toBe('0');
    expect(ensurePrescriptionPdf).toHaveBeenCalledWith('rx-1');
  });

  it('serves fresh signed URLs on repeated GET requests without caching', async () => {
    query.mockResolvedValue({
      rows: [{ pdf_url: 'prescription_rx-1_v2_12345678-1234-1234-1234-123456789abc.pdf' }],
    });
    ensurePrescriptionPdf
      .mockResolvedValueOnce({
        success: true,
        signedUrl: 'https://storage.example.com/url-1.pdf',
      })
      .mockResolvedValueOnce({
        success: true,
        signedUrl: 'https://storage.example.com/url-2.pdf',
      });

    const res1 = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');
    expect(res1.status).toBe(200);
    expect(res1.body.data.signedUrl).toBe('https://storage.example.com/url-1.pdf');

    const res2 = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');
    expect(res2.status).toBe(200);
    expect(res2.body.data.signedUrl).toBe('https://storage.example.com/url-2.pdf');
    expect(ensurePrescriptionPdf).toHaveBeenCalledTimes(2);
  });

  it('lets a doctor prepare a download link for any of their prescriptions', async () => {
    mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
    query.mockResolvedValue({
      rows: [{ pdf_url: 'prescription_rx-1_v2_12345678-1234-1234-1234-123456789abc.pdf' }],
    });
    ensurePrescriptionPdf.mockResolvedValueOnce({
      success: true,
      signedUrl: 'https://storage.example.com/existing.pdf',
    });

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');

    expect(response.status).toBe(200);
    expect(response.body.data.signedUrl).toBe('https://storage.example.com/existing.pdf');
    expect(ensurePrescriptionPdf).toHaveBeenCalledWith('rx-1');
  });

  it('does not prepare a PDF when the prescription has none stored', async () => {
    query.mockResolvedValue({ rows: [{ pdf_url: null }] });
    ensurePrescriptionPdf.mockClear();

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');

    expect(response.status).toBe(404);
    expect(ensurePrescriptionPdf).not.toHaveBeenCalled();
  });

  it('reports a preparation failure instead of returning a broken link', async () => {
    query.mockResolvedValue({
      rows: [{ pdf_url: 'prescription_rx-1_99999999-8888-7777-6666-555555555555.pdf' }],
    });
    ensurePrescriptionPdf.mockResolvedValueOnce({
      success: false,
      error: 'upload failed',
    });

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf-url');

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).toContain('upload failed');
  });

  it('regenerates on demand through the doctor PDF endpoint', async () => {
    mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
    query.mockResolvedValue({ rows: [{ id: 'rx-1' }] });
    generatePrescriptionPdfFile.mockResolvedValueOnce({
      success: true,
      signedUrl: 'https://storage.example.com/regenerated.pdf',
    });

    const response = await request(app).get('/api/v1/prescriptions/rx-1/pdf');

    expect(response.status).toBe(200);
    expect(response.body.data.signedUrl).toBe('https://storage.example.com/regenerated.pdf');
    expect(generatePrescriptionPdfFile).toHaveBeenCalledWith('rx-1');
  });
});
