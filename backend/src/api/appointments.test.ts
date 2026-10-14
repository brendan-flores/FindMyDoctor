/**
 * Tests for appointment booking with patient record completion status
 * These tests verify that booking respects PENDING vs COMPLETE associations
 */

import request from 'supertest';
import express from 'express';
import appointmentsRouter from './appointments';

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

jest.mock('../modules/availability/availabilityService', () => ({
  calculateAvailability: jest.fn(),
}));

const { query, getClient } = require('../database/connection');
const { calculateAvailability } = require('../modules/availability/availabilityService');

describe('Appointment Booking with Completion Status', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/appointments', appointmentsRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/appointments', () => {
    it('should reject booking when patient has PENDING association', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
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
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Patient record is incomplete');
    });

    it('should allow booking when patient has COMPLETE association', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      let queryCount = 0;
      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        queryCount++;
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // Return a COMPLETE association
          return Promise.resolve({ rows: [{ details_completion_status: 'COMPLETE' }] });
        }
        if (sql.includes('SELECT * FROM doctors')) {
          return Promise.resolve({ rows: [{ id: 'test-doctor-id', is_approved: true }] });
        }
        if (sql.includes('pg_try_advisory_xact_lock')) {
          return Promise.resolve({ rows: [{ lock_acquired: true }] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({ rows: [{ registered_count: 0, final_capacity: 10 }] });
        }
        if (sql.includes('INSERT INTO appointments')) {
          return Promise.resolve({ rows: [{ id: 'test-appointment-id' }] });
        }
        if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
          return Promise.resolve({ rows: [{ next_queue: 1 }] });
        }
        if (sql.includes('INSERT INTO queue_entries')) {
          return Promise.resolve();
        }
        if (sql.includes('UPDATE daily_capacities')) {
          return Promise.resolve();
        }
        if (sql.includes('INSERT INTO notifications')) {
          return Promise.resolve();
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      calculateAvailability.mockResolvedValue({
        status: 'AVAILABLE',
        availableSlots: 10,
      });

      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.appointmentId).toBe('test-appointment-id');
    });

    it('should respect explicit PENDING association despite prior appointment history', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
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
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Patient record is incomplete');
    });

    it('should allow booking for legacy records with no association but prior appointments', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      let queryCount = 0;
      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        queryCount++;
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments') && sql.includes('COUNT')) {
          // But has prior appointments (legacy record)
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
        if (sql.includes('SELECT * FROM doctors')) {
          return Promise.resolve({ rows: [{ id: 'test-doctor-id', is_approved: true }] });
        }
        if (sql.includes('pg_try_advisory_xact_lock')) {
          return Promise.resolve({ rows: [{ lock_acquired: true }] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({ rows: [{ registered_count: 0, final_capacity: 10 }] });
        }
        if (sql.includes('INSERT INTO appointments')) {
          return Promise.resolve({ rows: [{ id: 'test-appointment-id' }] });
        }
        if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
          return Promise.resolve({ rows: [{ next_queue: 1 }] });
        }
        if (sql.includes('INSERT INTO queue_entries')) {
          return Promise.resolve();
        }
        if (sql.includes('UPDATE daily_capacities')) {
          return Promise.resolve();
        }
        if (sql.includes('INSERT INTO notifications')) {
          return Promise.resolve();
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      calculateAvailability.mockResolvedValue({
        status: 'AVAILABLE',
        availableSlots: 10,
      });

      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.appointmentId).toBe('test-appointment-id');
    });

    it('should reject booking when no association and no appointment history', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments') && sql.includes('COUNT')) {
          // No appointment history
          return Promise.resolve({ rows: [{ count: '0' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Patient must submit required details');
    });

    it('should reject booking for legacy records with incomplete profile', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments') && sql.includes('COUNT')) {
          // Has prior appointments (legacy record)
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
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message || response.body.error).toContain('Patient record is incomplete');
    });

    it('should allow booking for legacy records with complete profile', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      getClient.mockResolvedValue(mockClient);

      let queryCount = 0;
      mockClient.query.mockImplementation((sql: string, params: any[]) => {
        queryCount++;
        if (sql.includes('BEGIN')) {
          return Promise.resolve();
        }
        if (sql.includes('SELECT id FROM patients')) {
          return Promise.resolve({ rows: [{ id: 'test-patient-id' }] });
        }
        if (sql.includes('patient_doctor_associations') && sql.includes('details_completion_status')) {
          // No association exists
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('appointments') && sql.includes('COUNT')) {
          // Has prior appointments (legacy record)
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
        if (sql.includes('SELECT * FROM doctors')) {
          return Promise.resolve({ rows: [{ id: 'test-doctor-id', is_approved: true }] });
        }
        if (sql.includes('pg_try_advisory_xact_lock')) {
          return Promise.resolve({ rows: [{ lock_acquired: true }] });
        }
        if (sql.includes('daily_capacities')) {
          return Promise.resolve({ rows: [{ registered_count: 0, final_capacity: 10 }] });
        }
        if (sql.includes('INSERT INTO appointments')) {
          return Promise.resolve({ rows: [{ id: 'test-appointment-id' }] });
        }
        if (sql.includes('SELECT COALESCE(MAX(queue_number)')) {
          return Promise.resolve({ rows: [{ next_queue: 1 }] });
        }
        if (sql.includes('INSERT INTO queue_entries')) {
          return Promise.resolve();
        }
        if (sql.includes('UPDATE daily_capacities')) {
          return Promise.resolve();
        }
        if (sql.includes('INSERT INTO notifications')) {
          return Promise.resolve();
        }
        if (sql.includes('COMMIT')) {
          return Promise.resolve();
        }
        return Promise.resolve({ rows: [] });
      });

      calculateAvailability.mockResolvedValue({
        status: 'AVAILABLE',
        availableSlots: 10,
      });

      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          doctorId: 'test-doctor-id',
          appointmentDate: '2026-10-20',
          reasonForVisit: 'Checkup',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.appointmentId).toBe('test-appointment-id');
    });
  });
});
