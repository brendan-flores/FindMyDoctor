/**
 * Tests for the doctor signature endpoints.
 *
 * Signatures live in the PRIVATE `doctor-signatures` Supabase bucket. These
 * tests verify that only doctors can manage their own signature, that uploads
 * are validated (PNG only, 4MB max, real PNG bytes), that replacements delete
 * the previous object only after the new path is persisted, and that previews
 * are returned as short-lived signed URLs instead of public paths.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import doctorsRouter from './doctors';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/storageService', () => ({
  uploadDoctorPhoto: jest.fn(),
  deleteDoctorPhoto: jest.fn(),
  replaceDoctorPhoto: jest.fn(),
  validateImageFile: jest.fn(),
  uploadDoctorSignature: jest.fn(),
  deleteDoctorSignature: jest.fn(),
  generateSignedDoctorSignatureUrl: jest.fn(),
  SIGNATURE_PREVIEW_URL_EXPIRY_SECONDS: 300,
}));

jest.mock('../services/otpService', () => ({
  ensureSecretarySupabaseIdentity: jest.fn(),
}));

jest.mock('../modules/availability/availabilityService', () => ({
  calculateAvailability: jest.fn(),
  calculateAvailabilityRange: jest.fn(),
  invalidateAvailabilityCache: jest.fn(),
}));

jest.mock('../modules/capacity/capacityService', () => ({
  calculateCapacity: jest.fn(),
  calculateCapacityRange: jest.fn(),
  buildCapacityResult: jest.fn(),
}));

jest.mock('../modules/scheduleChanges/scheduleChangeService', () => ({
  presentRequest: jest.fn(),
  evaluateProposal: jest.fn(),
  snapshotTarget: jest.fn(),
  toPendingSummary: jest.fn(),
}));

jest.mock('./scheduleChanges', () => ({
  REQUEST_SELECT: '',
}));

let mockUser: { id: string; role: string } = { id: 'doctor-user-id', role: 'DOCTOR' };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...allowedRoles: string[]) => (req: any, res: any, next: any) => {
    if (allowedRoles.includes(req.user?.role)) {
      next();
      return;
    }
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Forbidden' },
    });
  },
}));

const { query } = require('../database/connection');
const {
  uploadDoctorSignature,
  deleteDoctorSignature,
  generateSignedDoctorSignatureUrl,
  validateImageFile,
} = require('../services/storageService');

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function attachSignature(req: request.Test, buffer = PNG_BYTES, contentType = 'image/png') {
  return req.attach('signature', buffer, { filename: 'signature.png', contentType });
}

describe('Doctor signature API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/v1/doctors', doctorsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };
    validateImageFile.mockReturnValue({ valid: true });
  });

  describe('POST /api/v1/doctors/me/signature', () => {
    it('rejects non-doctor roles before touching storage', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };

      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature')
      );

      expect(response.status).toBe(403);
      expect(uploadDoctorSignature).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });

    it('uploads a valid PNG and stores only the private object path', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, signature_url FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'doctor-1', signature_url: null }] });
        }
        if (sql.includes('UPDATE doctors') && sql.includes('signature_url = $1')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });
      uploadDoctorSignature.mockResolvedValue({
        success: true,
        path: 'doctor_signature_doctor-1_123.png',
      });

      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature')
      );

      expect(response.status).toBe(200);
      expect(response.body.data.hasSignature).toBe(true);

      expect(uploadDoctorSignature).toHaveBeenCalledTimes(1);
      const [buffer, fileName, mimeType] = uploadDoctorSignature.mock.calls[0];
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(fileName).toMatch(/^doctor_signature_doctor-1_[\d-]+\.png$/);
      expect(mimeType).toBe('image/png');

      const updateCall = query.mock.calls.find(
        (call: any[]) => call[0].includes('UPDATE doctors') && call[0].includes('signature_url = $1')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1][0]).toBe('doctor_signature_doctor-1_123.png');
      expect(updateCall![1][1]).toBe('doctor-user-id');

      // A first upload has nothing to replace.
      expect(deleteDoctorSignature).not.toHaveBeenCalled();
    });

    it('deletes the previous object only after the new path is persisted', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, signature_url FROM doctors WHERE user_id')) {
          return Promise.resolve({
            rows: [{ id: 'doctor-1', signature_url: 'doctor_signature_doctor-1_old.png' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });
      uploadDoctorSignature.mockResolvedValue({
        success: true,
        path: 'doctor_signature_doctor-1_new.png',
      });
      deleteDoctorSignature.mockResolvedValue({ success: true });

      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature')
      );

      expect(response.status).toBe(200);
      expect(deleteDoctorSignature).toHaveBeenCalledWith('doctor_signature_doctor-1_old.png');

      const updateOrder = query.mock.invocationCallOrder[
        query.mock.calls.findIndex(
          (call: any[]) => call[0].includes('UPDATE doctors') && call[0].includes('signature_url = $1')
        )
      ];
      const deleteOrder = deleteDoctorSignature.mock.invocationCallOrder[0];
      expect(updateOrder).toBeLessThan(deleteOrder);
    });

    it('removes the new object when persisting the path fails', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, signature_url FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'doctor-1', signature_url: null }] });
        }
        if (sql.includes('UPDATE doctors') && sql.includes('signature_url = $1')) {
          return Promise.reject(new Error('database unavailable'));
        }
        return Promise.resolve({ rows: [] });
      });
      uploadDoctorSignature.mockResolvedValue({
        success: true,
        path: 'doctor_signature_doctor-1_orphan.png',
      });
      deleteDoctorSignature.mockResolvedValue({ success: true });

      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature')
      );

      expect(response.status).toBe(500);
      expect(deleteDoctorSignature).toHaveBeenCalledWith('doctor_signature_doctor-1_orphan.png');
    });

    it('rejects a file whose bytes are not a real PNG', async () => {
      validateImageFile.mockReturnValue({ valid: false, error: 'Invalid PNG file signature' });

      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature')
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid PNG file signature');
      expect(uploadDoctorSignature).not.toHaveBeenCalled();
    });

    it('rejects a non-PNG MIME type before storage', async () => {
      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature'),
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
        'image/jpeg'
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(uploadDoctorSignature).not.toHaveBeenCalled();
    });

    it('rejects files larger than 4MB', async () => {
      const oversized = Buffer.alloc(4 * 1024 * 1024 + 1);

      const response = await attachSignature(
        request(app).post('/api/v1/doctors/me/signature'),
        oversized
      );

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('4MB');
      expect(uploadDoctorSignature).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/v1/doctors/me/signature', () => {
    it('deletes the stored object and clears the path', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT signature_url FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ signature_url: 'doctor_signature_doctor-1_old.png' }] });
        }
        return Promise.resolve({ rows: [] });
      });
      deleteDoctorSignature.mockResolvedValue({ success: true });

      const response = await request(app).delete('/api/v1/doctors/me/signature');

      expect(response.status).toBe(200);
      expect(response.body.data.hasSignature).toBe(false);
      expect(deleteDoctorSignature).toHaveBeenCalledWith('doctor_signature_doctor-1_old.png');

      const clearCall = query.mock.calls.find((call: any[]) =>
        call[0].includes('signature_url = NULL')
      );
      expect(clearCall).toBeDefined();
    });

    it('keeps the stored path when storage deletion fails', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT signature_url FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ signature_url: 'doctor_signature_doctor-1_old.png' }] });
        }
        return Promise.resolve({ rows: [] });
      });
      deleteDoctorSignature.mockResolvedValue({ success: false, error: 'storage error' });

      const response = await request(app).delete('/api/v1/doctors/me/signature');

      expect(response.status).toBe(500);
      const clearCall = query.mock.calls.find((call: any[]) =>
        call[0].includes('signature_url = NULL')
      );
      expect(clearCall).toBeUndefined();
    });

    it('is a no-op when no signature is stored', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT signature_url FROM doctors WHERE user_id')) {
          return Promise.resolve({ rows: [{ signature_url: null }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app).delete('/api/v1/doctors/me/signature');

      expect(response.status).toBe(200);
      expect(deleteDoctorSignature).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/doctors/me/signature-url', () => {
    it('returns a short-lived signed URL and its expiry', async () => {
      query.mockResolvedValue({
        rows: [{ signature_url: 'doctor_signature_doctor-1.png' }],
      });
      generateSignedDoctorSignatureUrl.mockResolvedValue({
        success: true,
        signedUrl: 'https://storage.example.com/signature?signed=1',
      });

      const response = await request(app).get('/api/v1/doctors/me/signature-url');

      expect(response.status).toBe(200);
      expect(response.body.data.signedUrl).toBe(
        'https://storage.example.com/signature?signed=1'
      );
      expect(response.body.data.expiresInSeconds).toBe(300);
      expect(generateSignedDoctorSignatureUrl).toHaveBeenCalledWith(
        'doctor_signature_doctor-1.png'
      );
    });

    it('returns 404 when no signature has been uploaded', async () => {
      query.mockResolvedValue({ rows: [{ signature_url: null }] });

      const response = await request(app).get('/api/v1/doctors/me/signature-url');

      expect(response.status).toBe(404);
      expect(generateSignedDoctorSignatureUrl).not.toHaveBeenCalled();
    });

    it('fails when a signed URL cannot be generated', async () => {
      query.mockResolvedValue({
        rows: [{ signature_url: 'doctor_signature_doctor-1.png' }],
      });
      generateSignedDoctorSignatureUrl.mockResolvedValue({
        success: false,
        error: 'storage unavailable',
      });

      const response = await request(app).get('/api/v1/doctors/me/signature-url');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('storage unavailable');
    });
  });

  describe('GET /api/v1/doctors/me', () => {
    it('exposes has_signature without exposing the object path', async () => {
      query.mockResolvedValue({
        rows: [{ id: 'doctor-1', first_name: 'Jane', has_signature: true }],
      });

      const response = await request(app).get('/api/v1/doctors/me');

      expect(response.status).toBe(200);
      expect(response.body.data.has_signature).toBe(true);
      expect(response.body.data.signature_url).toBeUndefined();

      const selectSql = query.mock.calls[0][0] as string;
      expect(selectSql).toContain('AS has_signature');
      expect(selectSql).not.toContain('d.signature_url,');
    });
  });
});
