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

let mockUser = { id: 'test-user-id', role: 'PATIENT' };

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

const { query, getClient } = require('../database/connection');

describe('Patient API Validation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/patients', patientsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'test-user-id', role: 'PATIENT' };
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

  describe('GET /api/v1/patients/:id authorization', () => {
    it('should allow doctor to access patient through association', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM patients p') && sql.includes('WHERE p.id = $1') && sql.includes('EXISTS')) {
          // Main query with EXISTS subqueries
          expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 'doctor-user-id']);
          expect(sql).toContain('SELECT id FROM doctors WHERE user_id = $2');
          return Promise.resolve({
            rows: [{
              id: '550e8400-e29b-41d4-a716-446655440000',
              user_id: 'patient-user-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should allow doctor to access patient through appointment', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM patients p') && sql.includes('WHERE p.id = $1') && sql.includes('EXISTS')) {
          // Main query with EXISTS subqueries - association branch would be empty but appointment branch succeeds
          expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 'doctor-user-id']);
          expect(sql).toContain('SELECT id FROM doctors WHERE user_id = $2');
          expect(sql).toContain('patient_doctor_associations');
          expect(sql).toContain('appointments');
          return Promise.resolve({
            rows: [{
              id: '550e8400-e29b-41d4-a716-446655440000',
              user_id: 'patient-user-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should deny doctor access to unrelated patient (404)', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM patients p') && sql.includes('WHERE p.id = $1') && sql.includes('EXISTS')) {
          // Empty result from the actual detail query (no association or appointment)
          expect(params).toEqual(['unrelated-patient', 'doctor-user-id']);
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/unrelated-patient');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Patient not found or access denied');
    });

    it('should allow secretary to access patient through assigned doctor association', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM patients p') && sql.includes('WHERE p.id = $1') && sql.includes('EXISTS')) {
          // Main query with EXISTS subqueries
          expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 'secretary-user-id']);
          expect(sql).toContain('SELECT doctor_id FROM secretaries WHERE user_id = $2');
          return Promise.resolve({
            rows: [{
              id: '550e8400-e29b-41d4-a716-446655440000',
              user_id: 'patient-user-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should allow secretary to access patient through assigned doctor appointment', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM patients p') && sql.includes('WHERE p.id = $1') && sql.includes('EXISTS')) {
          // Main query with EXISTS subqueries - association branch would be empty but appointment branch succeeds
          expect(params).toEqual(['550e8400-e29b-41d4-a716-446655440000', 'secretary-user-id']);
          expect(sql).toContain('SELECT doctor_id FROM secretaries WHERE user_id = $2');
          expect(sql).toContain('patient_doctor_associations');
          expect(sql).toContain('appointments');
          return Promise.resolve({
            rows: [{
              id: '550e8400-e29b-41d4-a716-446655440000',
              user_id: 'patient-user-id',
              first_name: 'John',
              last_name: 'Doe',
              email: 'john@example.com'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should deny secretary access to unrelated patient (404)', async () => {
      mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM patients p') && sql.includes('WHERE p.id = $1') && sql.includes('EXISTS')) {
          // Empty result from the actual detail query (no association or appointment)
          expect(params).toEqual(['unrelated-patient', 'secretary-user-id']);
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/patients/unrelated-patient');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Patient not found or access denied');
    });

    it('should reject unsupported roles with 403', async () => {
      mockUser = { id: 'admin-user-id', role: 'ADMIN' };

      const response = await request(app)
        .get('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Invalid role');
    });

    it('should reject patient role with 403', async () => {
      mockUser = { id: 'patient-user-id', role: 'PATIENT' };

      const response = await request(app)
        .get('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Invalid role');
    });
  });

  describe('PUT /api/v1/patients/:id', () => {
    describe('Authorization Tests', () => {
      it('should use correct SQL with EXISTS subqueries for DOCTOR associations', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET') && sql.includes('WHERE id = $1') && sql.includes('EXISTS')) {
            expect(params[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(params[1]).toBe('doctor-user-id');
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(200);
      });

      it('should use correct SQL with EXISTS subqueries for SECRETARY associations', async () => {
        mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET') && sql.includes('WHERE id = $1') && sql.includes('EXISTS')) {
            expect(params[0]).toBe('550e8400-e29b-41d4-a716-446655440000');
            expect(params[1]).toBe('secretary-user-id');
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(200);
      });

      it('should include patients.id = $1 in outer WHERE clause', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(sql).toMatch(/WHERE id = \$1/);
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });
      });

      it('should include patient_id = $1 in each EXISTS subquery', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            const matches = sql.match(/WHERE pda\.patient_id = \$1/g);
            const matches2 = sql.match(/WHERE a\.patient_id = \$1/g);
            expect(matches).toBeTruthy();
            expect(matches2).toBeTruthy();
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });
      });

      it('should reject unsupported roles before query execution', async () => {
        mockUser = { id: 'admin-user-id', role: 'ADMIN' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(403);
        expect(query).not.toHaveBeenCalled();
      });

      it('should return unified 404 for zero-row UPDATE', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(404);
        expect(response.body.error.message).toContain('Patient not found or access denied');
      });
    });

    describe('Validation Tests', () => {
      it('should reject malformed UUID before SQL', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/invalid-uuid')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Invalid patient ID format');
        expect(query).not.toHaveBeenCalled();
      });

      it('should accept valid UUID format', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockResolvedValue({
          rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(200);
      });

      it('should reject missing required fields', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            // dateOfBirth missing
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Date of birth is required');
      });

      it('should reject wrong-type required fields', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 123, // wrong type
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('First name must be a string');
      });

      it('should reject empty required fields', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: '',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('First name must be 1-100 characters');
      });

      it('should reject whitespace-only required fields', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: '   ',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('First name must be 1-100 characters');
      });

      it('should validate name length (max 100)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'A'.repeat(101),
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('First name must be 1-100 characters');
      });

      it('should validate phone length (max 20)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789' + '0'.repeat(20),
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Mobile number must be 1-20 characters');
      });

      it('should reject invalid sex values', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'INVALID',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Sex must be one of');
      });

      it('should reject invalid phone format', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: 'invalid-phone',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Mobile number must contain only');
      });

      it('should reject invalid date format (not YYYY-MM-DD)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '01/01/1990',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Date of birth must be in YYYY-MM-DD format');
      });

      it('should reject future date of birth (timezone-independent)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        const futureDateStr = futureDate.toISOString().split('T')[0];

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: futureDateStr,
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Date of birth cannot be in the future');
      });

      it('should reject impossible calendar date (February 30)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '2020-02-30',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Invalid date of birth');
      });

      it('should reject date before 1900', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1899-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Date of birth year must be between 1900 and 2100');
      });

      it('should reject date after 2100', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '2101-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Date of birth year must be between 1900 and 2100');
      });
    });

    describe('Optional Field Tests', () => {
      it('should preserve current value when optional field omitted', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            // Check that presence flag is false for omitted field
            expect(params[8]).toBe(false); // hasMiddleName
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
            // middleName omitted
          });

        expect(response.status).toBe(200);
      });

      it('should clear to SQL NULL when optional field is explicit null', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[8]).toBe(true); // hasMiddleName
            expect(params[9]).toBe(null); // validatedMiddleName
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: null
          });

        expect(response.status).toBe(200);
      });

      it('should clear to SQL NULL when optional field is empty string', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[8]).toBe(true); // hasMiddleName
            expect(params[9]).toBe(null); // validatedMiddleName (empty string → null)
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: ''
          });

        expect(response.status).toBe(200);
      });

      it('should clear to SQL NULL when optional field is whitespace-only string', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[8]).toBe(true); // hasMiddleName
            expect(params[9]).toBe(null); // validatedMiddleName (whitespace → null)
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: '   '
          });

        expect(response.status).toBe(200);
      });

      it('should trim and save non-empty optional string', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[8]).toBe(true); // hasMiddleName
            expect(params[9]).toBe('Jane'); // validatedMiddleName (trimmed)
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: '  Jane  '
          });

        expect(response.status).toBe(200);
      });

      it('should reject optional field non-string value (number)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: 123
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('middleName must be a string or null');
      });

      it('should reject optional field non-string value (object)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: { value: 'test' }
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('middleName must be a string or null');
      });

      it('should validate middle name length (max 100)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: 'A'.repeat(101)
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Middle name must be maximum 100 characters');
      });
    });

    describe('Access Control Tests', () => {
      it('should deny DOCTOR access to unrelated patient (404)', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440001')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(404);
        expect(response.body.error.message).toContain('Patient not found or access denied');
      });

      it('should deny SECRETARY access to non-assigned doctor\'s patient (404)', async () => {
        mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

        query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440001')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });

        expect(response.status).toBe(404);
        expect(response.body.error.message).toContain('Patient not found or access denied');
      });
    });

    describe('Parameter Mapping Tests', () => {
      it('should use correct parameter positions for DOCTOR UPDATE', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[0]).toBe('550e8400-e29b-41d4-a716-446655440000'); // $1 patientId
            expect(params[1]).toBe('doctor-user-id'); // $2 userId
            expect(params[2]).toBe('John'); // $3 firstName
            expect(params[3]).toBe('Doe'); // $4 lastName
            expect(params[4]).toBe('1990-01-01'); // $5 dateOfBirth
            expect(params[5]).toBe('MALE'); // $6 sex
            expect(params[6]).toBe('09123456789'); // $7 phone
            expect(params[7]).toBe('123 Main St'); // $8 address
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });
      });

      it('should use correct parameter positions for SECRETARY UPDATE', async () => {
        mockUser = { id: 'secretary-user-id', role: 'SECRETARY' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[0]).toBe('550e8400-e29b-41d4-a716-446655440000'); // $1 patientId
            expect(params[1]).toBe('secretary-user-id'); // $2 userId
            expect(params[2]).toBe('John'); // $3 firstName
            expect(params[3]).toBe('Doe'); // $4 lastName
            expect(params[4]).toBe('1990-01-01'); // $5 dateOfBirth
            expect(params[5]).toBe('MALE'); // $6 sex
            expect(params[6]).toBe('09123456789'); // $7 phone
            expect(params[7]).toBe('123 Main St'); // $8 address
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St'
          });
      });

      it('should use presence flags and values for optional fields', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[8]).toBe(true); // $9 hasMiddleName
            expect(params[9]).toBe('Jane'); // $10 validatedMiddleName
            expect(params[10]).toBe(true); // $11 hasEmergencyContactName
            expect(params[11]).toBe('John'); // $12 validatedEmergencyContactName
            expect(params[12]).toBe(true); // $13 hasEmergencyContactPhone
            expect(params[13]).toBe('09123456789'); // $14 validatedEmergencyContactPhone
            expect(params[14]).toBe(true); // $15 hasMedicalHistory
            expect(params[15]).toBe('None'); // $16 validatedMedicalHistory
            expect(params[16]).toBe(true); // $17 hasAllergies
            expect(params[17]).toBe('None'); // $18 validatedAllergies
            expect(params[18]).toBe(true); // $19 hasCurrentMedications
            expect(params[19]).toBe('None'); // $20 validatedCurrentMedications
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            middleName: 'Jane',
            emergencyContactName: 'John',
            emergencyContactPhone: '09123456789',
            medicalHistory: 'None',
            allergies: 'None',
            currentMedications: 'None'
          });
      });

      it('should derive presence flags from request field presence', async () => {
        mockUser = { id: 'doctor-user-id', role: 'DOCTOR' };

        query.mockImplementation((sql: string, params: any[]) => {
          if (sql.includes('UPDATE patients SET')) {
            expect(params[8]).toBe(false); // middleName not in request
            expect(params[10]).toBe(true); // emergencyContactName in request
            return Promise.resolve({
              rows: [{ id: '550e8400-e29b-41d4-a716-446655440000', first_name: 'John', last_name: 'Doe' }]
            });
          }
          return Promise.resolve({ rows: [] });
        });

        await request(app)
          .put('/api/v1/patients/550e8400-e29b-41d4-a716-446655440000')
          .send({
            firstName: 'John',
            lastName: 'Doe',
            dateOfBirth: '1990-01-01',
            sex: 'MALE',
            phone: '09123456789',
            address: '123 Main St',
            emergencyContactName: 'John'
            // middleName omitted
          });
      });
    });
  });
});
