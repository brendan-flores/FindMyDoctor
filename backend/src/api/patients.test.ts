/**
 * Tests for patient API validation
 * These tests verify that the patient API correctly validates required fields
 * and enforces address as required for new patient submissions
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
    req.user = { id: 'test-user-id', role: 'PATIENT' };
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

const { query, getClient } = require('../database/connection');

describe('Patient API Validation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/patients', patientsRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/patients/submit-details', () => {
    it('should require address field', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          // address is missing
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Address is required');
    });

    it('should reject empty address', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '', // empty address
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Address is required');
    });

    it('should accept valid address', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('UPDATE patients')) {
            return { rows: [{ id: 'test-patient-id', first_name: 'John' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St, City',
        });

      expect(response.status).toBe(200);
    });

    it('should require all other required fields', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          // lastName missing
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Last name is required');
    });

    it('should validate sex enum values', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'INVALID', // invalid sex value
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Sex must be one of');
    });

    it('should validate mobile number format', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: 'invalid-phone', // invalid format
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Mobile number must contain only');
    });

    it('should validate date of birth is not in the future', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(app)
        .post('/api/v1/patients/submit-details')
        .send({
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: futureDate.toISOString().split('T')[0], // future date
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Date of birth cannot be in the future');
    });
  });

  describe('PUT /api/v1/patients/me', () => {
    it('should require address field for profile updates', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .put('/api/v1/patients/me')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          // address missing
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Address is required');
    });
  });

  describe('GET /api/v1/patients/check-record', () => {
    it('should return false for PENDING associations (incomplete walk-in accounts)', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // Return a PENDING association
          return Promise.resolve({ rows: [{ details_completion_status: 'PENDING' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(false);
      expect(response.body.message).toContain('Patient record is incomplete');
    });

    it('should return true for COMPLETE associations', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // Return a COMPLETE association
          return Promise.resolve({ rows: [{ details_completion_status: 'COMPLETE' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(true);
    });

    it('should respect explicit PENDING association despite prior appointment history', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // Return a PENDING association (authoritative)
          return Promise.resolve({ rows: [{ details_completion_status: 'PENDING' }] });
        }
        // Appointments table should not be queried when explicit association exists
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(false);
      expect(response.body.message).toContain('Patient record is incomplete');
    });

    it('should fallback to appointments table for backward compatibility (no association)', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments')) {
          // But has existing appointments (legacy record)
          return Promise.resolve({ rows: [{ count: '1' }] });
        }
        if (sql.includes('SELECT first_name, last_name, date_of_birth, sex, phone, address FROM patients')) {
          // Return complete profile
          return Promise.resolve({
            rows: [{
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '1990-01-01',
              sex: 'MALE',
              phone: '09123456789',
              address: '123 Main St'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(true);
    });

    it('should return false when no association and no appointment history', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments')) {
          // No appointment history
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(false);
    });

    it('should return false for legacy records with incomplete profile', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments')) {
          // Has appointment history (legacy record)
          return Promise.resolve({ rows: [{ count: '1' }] });
        }
        if (sql.includes('SELECT first_name, last_name, date_of_birth, sex, phone, address FROM patients')) {
          // Return incomplete profile (missing address)
          return Promise.resolve({
            rows: [{
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '1990-01-01',
              sex: 'MALE',
              phone: '09123456789',
              address: null // Missing address
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(false);
      expect(response.body.message).toContain('Patient record is incomplete');
    });

    it('should return true for legacy records with complete profile', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments')) {
          // Has appointment history (legacy record)
          return Promise.resolve({ rows: [{ count: '1' }] });
        }
        if (sql.includes('SELECT first_name, last_name, date_of_birth, sex, phone, address FROM patients')) {
          // Return complete profile
          return Promise.resolve({
            rows: [{
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '1990-01-01',
              sex: 'MALE',
              phone: '09123456789',
              address: '123 Main St'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/check-record')
        .query({ doctorId: 'test-doctor-id' });

      expect(response.status).toBe(200);
      expect(response.body.data.hasRecord).toBe(true);
      expect(response.body.message).toContain('Patient has existing record with this doctor');
    });
  });
});
