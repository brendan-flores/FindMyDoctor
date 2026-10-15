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

describe('GET /api/v1/appointments with patientId filter', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/appointments', appointmentsRouter);
    jest.clearAllMocks();
  });

  describe('DOCTOR role with patientId filter', () => {
    beforeEach(() => {
      mockUser = { id: 'test-doctor-user-id', role: 'DOCTOR' };
    });

    it('should include patient filter in query when patientId is provided', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 'apt-1', patient_id: 'patient-123', doctor_id: 'doctor-456', status: 'SCHEDULED' }
        ]
      });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=patient-123');

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalled();

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];
      const params = queryCall[1];

      // Verify the SQL includes patient_id filter
      expect(sqlText).toContain('AND a.patient_id =');
      // Verify the patientId parameter is in the params array
      expect(params).toContain('patient-123');
      // Verify the SQL includes doctor_id restriction
      expect(sqlText).toContain('WHERE a.doctor_id = (SELECT id FROM doctors WHERE user_id = $1)');
    });

    it('should return only matching appointments for the specified patient', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 'apt-1', patient_id: 'patient-123', doctor_id: 'doctor-456', status: 'SCHEDULED' },
          { id: 'apt-2', patient_id: 'patient-123', doctor_id: 'doctor-456', status: 'COMPLETED' }
        ]
      });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=patient-123');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((apt: any) => apt.patient_id === 'patient-123')).toBe(true);
    });

    it('should preserve doctor_id restriction when using patientId filter', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=patient-123');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];
      const params = queryCall[1];

      // Verify the WHERE clause includes doctor_id restriction BEFORE patient filter
      expect(sqlText).toContain('WHERE a.doctor_id = (SELECT id FROM doctors WHERE user_id = $1)');
      // Verify the patient filter is added with AND
      expect(sqlText).toContain('AND a.patient_id =');
      // Verify doctor user_id is the first parameter
      expect(params[0]).toBe('test-doctor-user-id');
      // Verify patientId is a later parameter
      expect(params.includes('patient-123')).toBe(true);
    });

    it('should combine patientId with status filter correctly', async () => {
      query.mockResolvedValue({
        rows: [
          { id: 'apt-1', patient_id: 'patient-123', doctor_id: 'doctor-456', status: 'SCHEDULED' }
        ]
      });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=patient-123&status=SCHEDULED');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];
      const params = queryCall[1];

      // Verify both filters are present
      expect(sqlText).toContain('AND a.status =');
      expect(sqlText).toContain('AND a.patient_id =');
      // Verify parameter bindings are preserved
      expect(params).toContain('SCHEDULED');
      expect(params).toContain('patient-123');
    });

    it('should combine patientId with startDate filter correctly', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=patient-123&startDate=2026-10-01');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];
      const params = queryCall[1];

      // Verify both filters are present
      expect(sqlText).toContain('AND a.appointment_date >=');
      expect(sqlText).toContain('AND a.patient_id =');
      expect(params).toContain('2026-10-01');
      expect(params).toContain('patient-123');
    });

    it('should not add patient filter when patientId is not provided', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];

      // Verify no patient filter is added
      expect(sqlText).not.toContain('AND a.patient_id =');
    });
  });

  describe('Other roles cannot use patientId filter', () => {
    it('PATIENT role should ignore patientId parameter', async () => {
      mockUser = { id: 'test-patient-user-id', role: 'PATIENT' };
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=some-patient-id');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];

      // Verify patient_id filter is NOT added (only doctor has this feature)
      expect(sqlText).not.toContain('AND a.patient_id =');
      // Verify it uses patient-specific query
      expect(sqlText).toContain('WHERE a.patient_id = (SELECT id FROM patients WHERE user_id = $1)');
    });

    it('SECRETARY role should ignore patientId parameter', async () => {
      mockUser = { id: 'test-secretary-user-id', role: 'SECRETARY' };
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=some-patient-id');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];

      // Verify patient_id filter is NOT added (only doctor has this feature)
      expect(sqlText).not.toContain('AND a.patient_id =');
      // Verify it uses secretary-specific query
      expect(sqlText).toContain('WHERE a.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $1)');
    });
  });

  describe('Authorization enforcement', () => {
    it('doctor cannot bypass doctor_id restriction using patientId', async () => {
      mockUser = { id: 'test-doctor-user-id', role: 'DOCTOR' };
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments?patientId=patient-123');

      expect(response.status).toBe(200);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];
      const params = queryCall[1];

      // Verify the query enforces doctor_id restriction
      expect(sqlText).toContain('WHERE a.doctor_id = (SELECT id FROM doctors WHERE user_id = $1)');
      // Verify the patient filter is an additional AND condition
      expect(sqlText).toContain('AND a.patient_id =');
      // Verify both conditions are present in the query
      expect(sqlText).toContain('WHERE a.doctor_id =');
      expect(sqlText).toContain('AND a.patient_id =');
      // Verify the doctor's user_id is the first parameter
      expect(params[0]).toBe('test-doctor-user-id');
    });
  });
});
