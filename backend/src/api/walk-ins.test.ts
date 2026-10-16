/**
 * Tests for walk-ins API security and validation
 * These tests verify secretary assignment enforcement, patient-doctor association persistence,
 * and patient detail validation in the walk-ins flow
 */

import request from 'supertest';
import express from 'express';
import walkInsRouter from './walk-ins';

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
  requireSecretaryPasswordChange: (req: any, res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (req: any, res: any, next: any) => next(),
}));

const { query, getClient } = require('../database/connection');

describe('Walk-ins API Security', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/walk-ins', walkInsRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/walk-ins', () => {
    it('should reject walk-in registration when secretary is not assigned to the doctor', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'different-doctor-id' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('You can only register walk-in patients for your assigned doctor');
    });

    it('should reject walk-in registration when patient has PENDING association', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // Association exists but is PENDING
            return { rows: [{ details_completion_status: 'PENDING' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('Patient details are incomplete');
    });

    it('should create patient-doctor association after successful walk-in registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // Association exists and is COMPLETE
            return { rows: [{ details_completion_status: 'COMPLETE' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true }] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('SELECT * FROM appointments')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(201);

      // Verify patient-doctor association was created
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations')
      );
      expect(associationCalls.length).toBeGreaterThan(0);
    });

    it('should allow legacy patient with complete profile and appointment history but no association', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql === 'SELECT * FROM patients WHERE id = $1') {
            // Complete profile
            return { rows: [{
              id: 'test-patient-id',
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '1990-01-01',
              sex: 'MALE',
              phone: '09123456789',
              address: '123 Main St'
            }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // No association exists - legacy patient
            return { rows: [] };
          }
          if (sql.includes('SELECT COUNT(*) as count') && sql.includes('appointments')) {
            // Legacy patient has appointment history
            return { rows: [{ count: '1' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true }] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('SELECT * FROM appointments')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(201);

      // Verify patient-doctor association was created for the legacy patient
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations') && call[0].includes('INSERT')
      );
      expect(associationCalls.length).toBeGreaterThan(0);
      expect(associationCalls[0][0]).toContain('COMPLETE');
    });

    it('should reject legacy patient with incomplete profile and appointment history', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql === 'SELECT * FROM patients WHERE id = $1') {
            // Incomplete profile - missing address
            return { rows: [{
              id: 'test-patient-id',
              first_name: 'John',
              last_name: 'Doe',
              date_of_birth: '1990-01-01',
              sex: 'MALE',
              phone: '09123456789',
              address: null
            }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // No association exists - legacy patient
            return { rows: [] };
          }
          if (sql.includes('SELECT COUNT(*) as count') && sql.includes('appointments')) {
            // Legacy patient has appointment history
            return { rows: [{ count: '1' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('Patient details are incomplete. Please submit required patient details before registering for an appointment.');
    });

    it('should reject legacy patient with no association and no appointment history', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // No association exists
            return { rows: [] };
          }
          if (sql.includes('SELECT COUNT(*) as count FROM appointments')) {
            // No appointment history either
            return { rows: [{ count: '0' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('not associated with this doctor');
    });
  });

  describe('POST /api/v1/walk-ins/create-account', () => {
    it('should reject account creation when secretary is not assigned to the doctor', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'different-doctor-id' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/create-account')
        .send({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          doctorId: 'test-doctor-id',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('You can only create accounts for your assigned doctor');
    });

    it('should create patient-doctor association when creating account', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
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
        .post('/api/v1/walk-ins/create-account')
        .send({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          doctorId: 'test-doctor-id',
        });

      expect(response.status).toBe(201);

      // Verify patient-doctor association was created with PENDING status
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations')
      );
      expect(associationCalls.length).toBeGreaterThan(0);
      expect(associationCalls[0][0]).toContain('PENDING');
    });
  });

  describe('GET /api/v1/walk-ins/search', () => {
    it('should only return patients associated with secretary\'s assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'test-doctor-id' }] });
        }
        if (sql.includes('SELECT u.id, u.email')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id', email: 'test@example.com' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/walk-ins/search')
        .query({ email: 'test@example.com' });

      expect(response.status).toBe(200);

      // Verify the query includes the association check
      const searchCalls = query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations')
      );
      expect(searchCalls.length).toBeGreaterThan(0);
    });

    it('should return 404 for patients not associated with assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'test-doctor-id' }] });
        }
        if (sql.includes('SELECT u.id, u.email')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/walk-ins/search')
        .query({ email: 'other@example.com' });

      expect(response.status).toBe(404);
      expect(response.body.error.message || response.body.error).toContain('not associated with your assigned doctor');
    });
  });

  describe('POST /api/v1/walk-ins/submit-patient-details', () => {
    it('should reject when secretary is not assigned to the doctor', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'different-doctor-id' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('You can only submit patient details for your assigned doctor');
    });

    it('should require all required patient detail fields', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
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

    it('should validate sex enum values', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // Association exists with PENDING status
            return { rows: [{ id: 'test-association-id', details_completion_status: 'PENDING' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'INVALID',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Sex must be one of');
    });

    it('should allow legacy patient with appointment history but no association to submit details', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql === 'SELECT id FROM patients WHERE id = $1') {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // No association exists - legacy patient
            return { rows: [] };
          }
          if (sql.includes('SELECT COUNT(*) as count') && sql.includes('appointments')) {
            // Legacy patient has appointment history
            return { rows: [{ count: '1' }] };
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
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(200);

      // Verify patient-doctor association was created for the legacy patient
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations') && call[0].includes('COMPLETE')
      );
      expect(associationCalls.length).toBeGreaterThan(0);

      // Verify the INSERT was used (not UPDATE) since no association existed
      const insertCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('INSERT INTO patient_doctor_associations')
      );
      expect(insertCalls.length).toBeGreaterThan(0);
    });

    it('should reject legacy patient with no association and no appointment history', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // No association exists
            return { rows: [] };
          }
          if (sql.includes('SELECT COUNT(*) as count FROM appointments')) {
            // No appointment history either
            return { rows: [{ count: '0' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('not associated with this doctor');
    });

    it('should validate mobile number format', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // Association exists with PENDING status
            return { rows: [{ id: 'test-association-id', details_completion_status: 'PENDING' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: 'invalid-phone',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Mobile number must contain only');
    });

    it('should validate date of birth is not in the future', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // Association exists with PENDING status
            return { rows: [{ id: 'test-association-id', details_completion_status: 'PENDING' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: futureDate.toISOString().split('T')[0],
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Date of birth cannot be in the future');
    });

    it('should create patient-doctor association after successful detail submission', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // Association exists with PENDING status
            return { rows: [{ id: 'test-association-id', details_completion_status: 'PENDING' }] };
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
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(200);

      // Verify patient-doctor association was updated to COMPLETE
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations') && call[0].includes('COMPLETE')
      );
      expect(associationCalls.length).toBeGreaterThan(0);
    });

    it('should create PENDING association when creating account', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
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
        .post('/api/v1/walk-ins/create-account')
        .send({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          doctorId: 'test-doctor-id',
        });

      expect(response.status).toBe(201);

      // Verify patient-doctor association was created with PENDING status
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations')
      );
      expect(associationCalls.length).toBeGreaterThan(0);
      expect(associationCalls[0][0]).toContain('PENDING');
    });
  });

  describe('POST /api/v1/walk-ins/submit-patient-details - Security', () => {
    it('should reject when patient is not associated with the doctor', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // No association exists
            return { rows: [] };
          }
          if (sql.includes('SELECT COUNT(*) as count FROM appointments')) {
            // No appointment history either
            return { rows: [{ count: '0' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('Patient is not associated with this doctor');
    });

    it('should update association to COMPLETE when details are submitted', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // Association exists with PENDING status
            return { rows: [{ id: 'test-association-id', details_completion_status: 'PENDING' }] };
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
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(200);

      // Verify association was updated to COMPLETE
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations') && call[0].includes('COMPLETE')
      );
      expect(associationCalls.length).toBeGreaterThan(0);

      // Verify the ON CONFLICT UPDATE was used since association existed
      const onConflictCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('ON CONFLICT') && call[0].includes('patient_doctor_associations')
      );
      expect(onConflictCalls.length).toBeGreaterThan(0);
    });

    it('should not change association status when validation fails', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT id FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT id, details_completion_status')) {
            // Association exists with PENDING status
            return { rows: [{ id: 'test-association-id', details_completion_status: 'PENDING' }] };
          }
          // No patient update should occur if validation fails
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/submit-patient-details')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'INVALID_SEX', // Invalid sex value
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);

      // Verify no association update occurred due to validation failure
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations') && call[0].includes('COMPLETE')
      );
      expect(associationCalls.length).toBe(0);
    });
  });

  describe('POST /api/v1/walk-ins - Registration Validation', () => {
    it('should reject registration when patient has PENDING association', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // Association exists but is PENDING
            return { rows: [{ details_completion_status: 'PENDING' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message || response.body.error).toContain('Patient details are incomplete');
    });

    it('should allow registration when patient has COMPLETE association', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // Association exists and is COMPLETE
            return { rows: [{ details_completion_status: 'COMPLETE' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true }] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('SELECT * FROM appointments')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(201);
    });

    it('should not create duplicate associations during walk-in registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('SELECT details_completion_status')) {
            // Association exists and is already COMPLETE
            return { rows: [{ details_completion_status: 'COMPLETE' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true }] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('SELECT * FROM appointments')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE patient_doctor_associations')) {
            // Should update to COMPLETE
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            // Should not insert duplicate (uses ON CONFLICT with UPDATE)
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins')
        .send({
          patientId: 'test-patient-id',
          doctorId: 'test-doctor-id',
          appointmentDate: '2024-12-01',
        });

      expect(response.status).toBe(201);

      // Verify association was updated (uses ON CONFLICT to handle duplicates)
      const associationCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('patient_doctor_associations') && call[0].includes('ON CONFLICT')
      );
      expect(associationCalls.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/walk-ins/direct-register', () => {
    it('should register walk-in patient directly without mandatory search', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] }; // Email does not exist
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('temporaryPassword');
      expect(response.body.data).toHaveProperty('queueNumber');
      expect(response.body.data).toHaveProperty('patientEmail', 'test@example.com');
    });

    it('should reject duplicate email during direct registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [{ id: 'existing-user-id' }] }; // Email already exists
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'existing@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message || response.body.error).toContain('Email already registered');
    });

    it('should require all required fields in direct registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('required');
    });

    it('should validate mobile number format in direct registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: 'invalid-phone!', // Invalid characters
          address: '123 Main St',

        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Mobile number must contain only digits');
    });

    it('should enforce queue capacity in direct registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 10, final_capacity: 10 }] }; // Full capacity
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',

        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('No available slots');
    });

    it('should use secretary\'s assigned doctor in direct registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'assigned-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'assigned-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            // Verify the doctor_id is the assigned doctor's ID
            expect(params[1]).toBe('assigned-doctor-id');
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',

        });

      expect(response.status).toBe(201);
    });

    it('should set must_change_password to true for walk-in accounts', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            // Verify must_change_password is set to true (hardcoded in SQL)
            expect(sql).toContain('must_change_password');
            expect(sql).toContain('true'); // The hardcoded value
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',

        });

      expect(response.status).toBe(201);
    });

    it('should create COMPLETE patient-doctor association in direct registration', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            // Verify association is COMPLETE
            expect(sql).toContain('COMPLETE');
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(201);
    });

    it('should generate password with both letters and numbers', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('temporaryPassword');
      const password = response.body.data.temporaryPassword;
      expect(password).toMatch(/[A-Za-z]/); // Contains letters
      expect(password).toMatch(/[0-9]/); // Contains numbers
      expect(password.length).toBe(12); // 12 characters
    });

    it('should not return temporary password on failure', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [{ id: 'existing-user-id' }] }; // Email already exists
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'existing@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(409);
      expect(response.body.data).toBeUndefined(); // No data returned on failure
      // If data is undefined, it cannot have temporaryPassword property
    });

    it('should rollback transaction on capacity check failure', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [] }; // No capacity configured
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('No capacity configured');

      // Verify ROLLBACK was called
      const rollbackCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('ROLLBACK')
      );
      expect(rollbackCalls.length).toBeGreaterThan(0);
    });

    it('should prevent duplicate queue entries on concurrent requests (transaction rollback)', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'test-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors')) {
            return { rows: [{ id: 'test-doctor-id', is_approved: true, first_name: 'John', last_name: 'Smith' }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'test-user-id', email: 'test@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'test-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'test-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            // Simulate unique constraint violation (duplicate queue number)
            const error: any = new Error('Duplicate queue entry');
            error.code = '23505';
            error.constraint = 'queue_entries_queue_date_doctor_id_queue_number_key';
            throw error;
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'test@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'FEMALE',
          phone: '09123456789',
          address: '123 Main St',
        });

      expect(response.status).toBe(409); // Conflict

      // Verify ROLLBACK was called on constraint violation
      const rollbackCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('ROLLBACK')
      );
      expect(rollbackCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Direct Walk-In Queue Integration', () => {
    it('should create queue entry that appears in secretary\'s authorized queue', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'assigned-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors WHERE id = $1 AND is_approved = true')) {
            return { rows: [{ id: 'assigned-doctor-id', first_name: 'Dr.', last_name: 'Smith', is_approved: true }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'new-user-id', email: 'walkin@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'new-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'new-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 1 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'walkin@example.com',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St'
        });

      expect(response.status).toBe(201);

      // Verify queue entry was created with WALK_IN source
      const queueInsertCalls = mockClient.query.mock.calls.filter((call: any[]) =>
        call[0].includes('INSERT INTO queue_entries')
      );
      expect(queueInsertCalls.length).toBeGreaterThan(0);
      expect(queueInsertCalls[0][0]).toContain('WALK_IN');
      expect(queueInsertCalls[0][0]).toContain('WAITING');
    });

    it('should include queue_number in direct walk-in response', async () => {
      const mockClient = {
        query: jest.fn((sql: string, params: any[]) => {
          if (sql.includes('SELECT doctor_id FROM secretaries')) {
            return { rows: [{ doctor_id: 'assigned-doctor-id' }] };
          }
          if (sql.includes('SELECT * FROM doctors WHERE id = $1 AND is_approved = true')) {
            return { rows: [{ id: 'assigned-doctor-id', first_name: 'Dr.', last_name: 'Smith', is_approved: true }] };
          }
          if (sql.includes('SELECT id FROM users WHERE email')) {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO users')) {
            return { rows: [{ id: 'new-user-id', email: 'walkin@example.com', must_change_password: true }] };
          }
          if (sql.includes('INSERT INTO patients')) {
            return { rows: [{ id: 'new-patient-id' }] };
          }
          if (sql.includes('INSERT INTO patient_doctor_associations')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT pg_try_advisory_xact_lock')) {
            return { rows: [{ lock_acquired: true }] };
          }
          if (sql.includes('SELECT * FROM daily_capacities')) {
            return { rows: [{ registered_count: 0, final_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO appointments')) {
            return { rows: [{ id: 'new-appointment-id' }] };
          }
          if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
            return { rows: [{ next_queue: 5 }] };
          }
          if (sql.includes('INSERT INTO queue_entries')) {
            return { rows: [] };
          }
          if (sql.includes('UPDATE daily_capacities')) {
            return { rows: [] };
          }
          if (sql.includes('SELECT final_capacity')) {
            return { rows: [{ total_capacity: 10 }] };
          }
          if (sql.includes('INSERT INTO notifications')) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      const response = await request(app)
        .post('/api/v1/walk-ins/direct-register')
        .send({
          email: 'walkin@example.com',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          sex: 'MALE',
          phone: '09123456789',
          address: '123 Main St'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.queueNumber).toBe(5);
    });
  });
});
