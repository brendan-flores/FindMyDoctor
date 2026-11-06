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

let mockUser: any = { id: 'test-user-id', role: 'PATIENT', mustChangePassword: false };

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
  requirePasswordChange: (req: any, res: any, next: any) => {
    if (req.user?.mustChangePassword) {
      return res.status(403).json({
        error: {
          code: 'MUST_CHANGE_PASSWORD',
          message: 'Password change required'
        }
      });
    }
    next();
  },
}));

jest.mock('../modules/availability/availabilityService', () => ({
  calculateAvailability: jest.fn(),
  invalidateAvailabilityCache: jest.fn(),
}));

const { query, getClient } = require('../database/connection');
const { calculateAvailability, invalidateAvailabilityCache } = require('../modules/availability/availabilityService');

/**
 * Booking requests must target a future date because the API rejects past
 * dates. A hardcoded date would start failing as the calendar advances.
 */
function futureBookingDate(offsetDays = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
          appointmentDate: futureBookingDate(),
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
          appointmentDate: futureBookingDate(),
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
          appointmentDate: futureBookingDate(),
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
          appointmentDate: futureBookingDate(),
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
          appointmentDate: futureBookingDate(),
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
          appointmentDate: futureBookingDate(),
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
          appointmentDate: futureBookingDate(),
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
      expect(params).toContain('2026-10-01');
    });
  });
});

describe('Password Change Enforcement on Appointments', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/appointments', appointmentsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/v1/appointments', () => {
    it('should block access when mustChangePassword is true', async () => {
      mockUser = { id: 'test-user-id', role: 'PATIENT', mustChangePassword: true };

      const response = await request(app)
        .get('/api/v1/appointments');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('MUST_CHANGE_PASSWORD');
      expect(response.body.error.message).toBe('Password change required');
    });

    it('should allow access when mustChangePassword is false', async () => {
      mockUser = { id: 'test-user-id', role: 'PATIENT', mustChangePassword: false };

      query.mockResolvedValue({
        rows: [
          { id: 'apt-1', patient_id: 'patient-123', doctor_id: 'doctor-456', status: 'SCHEDULED' }
        ]
      });

      const response = await request(app)
        .get('/api/v1/appointments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/appointments', () => {
    it('should block booking when mustChangePassword is true', async () => {
      mockUser = { id: 'test-user-id', role: 'PATIENT', mustChangePassword: true };

      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          doctorId: 'doctor-123',
          appointmentDate: futureBookingDate()
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('MUST_CHANGE_PASSWORD');
      expect(response.body.error.message).toBe('Password change required');
    });

    it('should allow booking when mustChangePassword is false', async () => {
      mockUser = { id: 'test-user-id', role: 'PATIENT', mustChangePassword: false };

      const response = await request(app)
        .post('/api/v1/appointments')
        .send({
          doctorId: 'doctor-123',
          appointmentDate: futureBookingDate()
        });

      // Verify it's NOT blocked by password change guard (would be 403 if blocked)
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(403);
    });
  });
});

describe('GET /api/v1/appointments/:id authorization', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/appointments', appointmentsRouter);
    jest.clearAllMocks();
  });

  describe('DOCTOR role appointment detail access', () => {
    beforeEach(() => {
      mockUser = { id: 'test-doctor-user-id', role: 'DOCTOR' };
    });

    it('should allow doctor to access their own appointment', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM appointments a') && sql.includes('WHERE a.id = $1')) {
          // Main query with doctor_id restriction
          expect(params).toEqual(['apt-123', 'test-doctor-user-id']);
          expect(sql).toContain('WHERE a.id = $1 AND a.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)');
          return Promise.resolve({
            rows: [{
              id: 'apt-123',
              patient_id: 'patient-456',
              doctor_id: 'doctor-789',
              appointment_date: '2026-10-20',
              status: 'SCHEDULED',
              patient_first_name: 'John',
              patient_last_name: 'Doe'
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/appointments/apt-123');

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe('apt-123');
    });

    it('should deny doctor access to another doctor\'s appointment (404)', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM appointments a') && sql.includes('WHERE a.id = $1')) {
          // Empty result - appointment belongs to another doctor
          expect(params).toEqual(['other-apt-123', 'test-doctor-user-id']);
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/appointments/other-apt-123');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Appointment not found');
    });

    it('should enforce doctor_id restriction in SQL query', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/v1/appointments/apt-123');

      expect(response.status).toBe(404);

      const queryCall = query.mock.calls[0];
      const sqlText = queryCall[0];
      const params = queryCall[1];

      // Verify the WHERE clause includes doctor_id restriction
      expect(sqlText).toContain('WHERE a.id = $1 AND a.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)');
      // Verify appointment ID is the first parameter
      expect(params[0]).toBe('apt-123');
      // Verify doctor user_id is the second parameter
      expect(params[1]).toBe('test-doctor-user-id');
    });
  });
});

describe('Appointment Cancellation with Queue Renumbering', () => {
  let app: express.Application;
  let mockClient: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/appointments', appointmentsRouter);
    mockUser = { id: 'test-patient-user-id', role: 'PATIENT', mustChangePassword: false };
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  it('should delete queue entry and renumber queue on cancellation', async () => {
    mockClient.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('BEGIN')) {
        return Promise.resolve();
      }
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        // Get appointment with queue info
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            appointment_date: '2026-10-20',
            status: 'SCHEDULED',
            queue_number: 1,
            queue_date: '2026-10-20'
          }]
        });
      }
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve({ rows: [{ lock_acquired: true }] });
      }
      if (sql.includes("UPDATE appointments SET status = 'CANCELLED'")) {
        return Promise.resolve();
      }
      if (sql.includes('DELETE FROM queue_entries')) {
        // Verify queue entry is deleted (not just status-updated)
        expect(sql).toContain('DELETE FROM queue_entries WHERE appointment_id = $1');
        expect(params).toEqual(['apt-1']);
        return Promise.resolve();
      }
      if (sql.includes('SELECT') && sql.includes('queue_entries q') && sql.includes('queue_number >')) {
        // Get affected entries for renumbering
        // The query uses: q.queue_number as old_queue_number
        return Promise.resolve({
          rows: [{
            id: 'queue-2',
            patient_id: 'patient-456',
            old_queue_number: 2
          }]
        });
      }
      if (sql.includes('UPDATE queue_entries') && sql.includes('SET queue_number')) {
        // Verify queue renumbering
        // The code calculates: newQueueNumber = entry.old_queue_number - 1
        // With old_queue_number = 2, new should be 1
        expect(params[0]).toBe(1);
        expect(params[1]).toBe('queue-2');
        return Promise.resolve();
      }
      if (sql.includes('INSERT INTO notifications')) {
        return Promise.resolve();
      }
      if (sql.includes('UPDATE daily_capacities')) {
        return Promise.resolve();
      }
      if (sql.includes('COMMIT')) {
        return Promise.resolve();
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/cancel');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Appointment cancelled successfully');

    // Verify DELETE was called (not UPDATE status)
    const deleteCalls = mockClient.query.mock.calls.filter((call: any[]) => 
      call[0].includes('DELETE FROM queue_entries')
    );
    expect(deleteCalls.length).toBe(1);

    // Verify queue renumbering was called
    const renumberCalls = mockClient.query.mock.calls.filter((call: any[]) => 
      call[0].includes('UPDATE queue_entries') && call[0].includes('SET queue_number')
    );
    expect(renumberCalls.length).toBe(1);

    // Verify notification was sent
    const notificationCalls = mockClient.query.mock.calls.filter((call: any[]) => 
      call[0].includes('INSERT INTO notifications') && call[0].includes('QUEUE_UPDATED')
    );
    expect(notificationCalls.length).toBe(1);
  });

  it('should handle cancellation when no patients behind in queue', async () => {
    mockClient.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('BEGIN')) {
        return Promise.resolve();
      }
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            appointment_date: '2026-10-20',
            status: 'SCHEDULED',
            queue_number: 1,
            queue_date: '2026-10-20'
          }]
        });
      }
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve({ rows: [{ lock_acquired: true }] });
      }
      if (sql.includes("UPDATE appointments SET status = 'CANCELLED'")) {
        return Promise.resolve();
      }
      if (sql.includes('DELETE FROM queue_entries')) {
        return Promise.resolve();
      }
      if (sql.includes('SELECT') && sql.includes('queue_entries q') && sql.includes('queue_number >')) {
        // No affected entries (no patients behind)
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('UPDATE daily_capacities')) {
        return Promise.resolve();
      }
      if (sql.includes('COMMIT')) {
        return Promise.resolve();
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/cancel');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify no renumbering occurred (no UPDATE queue_number calls)
    const renumberCalls = mockClient.query.mock.calls.filter((call: any[]) => 
      call[0].includes('UPDATE queue_entries') && call[0].includes('SET queue_number')
    );
    expect(renumberCalls.length).toBe(0);
  });

  it('should reject cancellation for already cancelled or completed appointments', async () => {
    mockClient.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('BEGIN')) {
        return Promise.resolve();
      }
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            appointment_date: '2026-10-20',
            status: 'CANCELLED', // Already cancelled
            queue_number: 1,
            queue_date: '2026-10-20'
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/cancel');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_APPOINTMENT_STATUS');
  });
});

describe('Patient appointment reschedule and cancellation authorization', () => {
  let app: express.Application;
  let mockClient: any;

  // Reschedule rejects past dates, so tests build dates relative to today.
  const futureDate = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const oldDate = futureDate(7);
  const newDate = futureDate(10);

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/appointments', appointmentsRouter);
    mockUser = { id: 'test-patient-user-id', role: 'PATIENT', mustChangePassword: false };
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    getClient.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  it('should return 403 when a patient cancels another patient\'s appointment', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN')) return Promise.resolve();
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-999',
            doctor_id: 'doctor-456',
            appointment_date: '2026-10-20',
            status: 'SCHEDULED',
            queue_number: 1,
            queue_date: '2026-10-20'
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app).patch('/api/v1/appointments/apt-1/cancel');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');

    const statusUpdates = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes("UPDATE appointments SET status = 'CANCELLED'")
    );
    expect(statusUpdates.length).toBe(0);
  });

  it('should notify the patient with APPOINTMENT_CANCELLED on cancellation', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN')) return Promise.resolve();
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            appointment_date: '2026-10-20',
            status: 'SCHEDULED',
            queue_number: 3,
            queue_date: '2026-10-20'
          }]
        });
      }
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve({ rows: [{ lock_acquired: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app).patch('/api/v1/appointments/apt-1/cancel');

    expect(response.status).toBe(200);

    const cancelledNotifications = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes('INSERT INTO notifications') && call[0].includes('APPOINTMENT_CANCELLED')
    );
    expect(cancelledNotifications.length).toBe(1);
    expect(cancelledNotifications[0][1][0]).toBe('test-patient-user-id');
    expect(cancelledNotifications[0][1][1]).toContain('2026-10-20');
    expect(cancelledNotifications[0][1][2]).toBe('apt-1');
  });

  // Builds a mock that serves a successful reschedule for the given appointment.
  const mockSuccessfulReschedule = (appointmentOverrides: Record<string, any> = {}) => {
    mockClient.query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('BEGIN')) return Promise.resolve();
      if (sql.includes('ROLLBACK')) return Promise.resolve();
      if (sql.includes('COMMIT')) return Promise.resolve();
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('date, final_capacity, registered_count')) {
        return Promise.resolve({
          rows: [
            { date: oldDate, final_capacity: 10, registered_count: 6 },
            { date: newDate, final_capacity: 10, registered_count: 4 }
          ]
        });
      }
      if (sql.includes('COALESCE(MAX(queue_number)')) {
        return Promise.resolve({ rows: [{ next_queue: 5 }] });
      }
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve({ rows: [{ lock_acquired: true }] });
      }
      if (sql.includes('queue_number >')) {
        return Promise.resolve({
          rows: [{ id: 'queue-9', patient_id: 'patient-9', old_queue_number: 3 }]
        });
      }
      if (sql.includes('SELECT id FROM appointments') && sql.includes('patient_id')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            appointment_date: oldDate,
            status: 'SCHEDULED',
            queue_entry_id: 'queue-1',
            queue_number: 2,
            queue_date: oldDate,
            queue_status: 'WAITING',
            started_at: null,
            doctor_first_name: 'Maria',
            doctor_last_name: 'Santos',
            ...appointmentOverrides
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });
  };

  it('should move the queue entry, swap capacity and notify on reschedule', async () => {
    calculateAvailability.mockResolvedValue({ status: 'AVAILABLE' });
    mockSuccessfulReschedule();

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: newDate });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.previousDate).toBe(oldDate);
    expect(response.body.data.previousQueueNumber).toBe(2);
    expect(response.body.data.appointmentDate).toBe(newDate);
    expect(response.body.data.queueNumber).toBe(5);

    // Both dates must be locked (sorted, one advisory lock each).
    const lockCalls = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes('pg_try_advisory_xact_lock')
    );
    expect(lockCalls.length).toBe(2);

    // Old date decremented, new date incremented.
    const capacityCalls = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes('UPDATE daily_capacities')
    );
    expect(capacityCalls.length).toBe(2);
    expect(capacityCalls[0][1]).toEqual(['doctor-456', oldDate]);
    expect(capacityCalls[1][1]).toEqual(['doctor-456', newDate]);

    // The gap left on the old date is closed (queue #3 -> #2).
    const renumberCalls = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes('UPDATE queue_entries') && call[0].includes('SET queue_number')
    );
    expect(renumberCalls.length).toBe(1);
    expect(renumberCalls[0][1]).toEqual([2, 'queue-9']);

    // Patient is notified with the old AND new schedule.
    const rescheduleNotifications = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes('APPOINTMENT_RESCHEDULED')
    );
    expect(rescheduleNotifications.length).toBe(1);
    const message = rescheduleNotifications[0][1][1];
    expect(message).toContain(oldDate);
    expect(message).toContain(newDate);
    expect(message).toContain('#2');
    expect(message).toContain('#5');
    expect(rescheduleNotifications[0][1][2]).toBe('apt-1');
  });

  it('should return 403 when a patient reschedules another patient\'s appointment', async () => {
    calculateAvailability.mockResolvedValue({ status: 'AVAILABLE' });
    mockSuccessfulReschedule({ patient_id: 'patient-999' });

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: newDate });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('should reject rescheduling an appointment that has already started', async () => {
    calculateAvailability.mockResolvedValue({ status: 'AVAILABLE' });
    mockSuccessfulReschedule({ queue_status: 'IN_CHECKUP' });

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: newDate });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_APPOINTMENT_STATUS');
  });

  it('should reject rescheduling to the same date', async () => {
    calculateAvailability.mockResolvedValue({ status: 'AVAILABLE' });
    mockSuccessfulReschedule();

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: oldDate });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject rescheduling to a fully booked date', async () => {
    calculateAvailability.mockResolvedValue({ status: 'FULL' });
    mockSuccessfulReschedule();

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: newDate });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CAPACITY_FULL');

    const moves = mockClient.query.mock.calls.filter(
      (call: any[]) => call[0].includes('UPDATE queue_entries')
    );
    expect(moves.length).toBe(0);
  });

  it('should reject rescheduling to a date the doctor is unavailable', async () => {
    calculateAvailability.mockResolvedValue({ status: 'NON_WORKING' });
    mockSuccessfulReschedule();

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: newDate });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('APPOINTMENT_SLOT_UNAVAILABLE');
  });

  it('should return 429 when the queue is locked by another transaction', async () => {
    calculateAvailability.mockResolvedValue({ status: 'AVAILABLE' });
    mockSuccessfulReschedule();

    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN')) return Promise.resolve();
      if (sql.includes('SELECT id FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-123' }] });
      }
      if (sql.includes('SELECT') && sql.includes('appointments a')) {
        return Promise.resolve({
          rows: [{
            id: 'apt-1',
            patient_id: 'patient-123',
            doctor_id: 'doctor-456',
            appointment_date: oldDate,
            status: 'SCHEDULED',
            queue_entry_id: 'queue-1',
            queue_number: 2,
            queue_date: oldDate,
            queue_status: 'WAITING',
            started_at: null,
            doctor_first_name: 'Maria',
            doctor_last_name: 'Santos',
          }]
        });
      }
      if (sql.includes('pg_try_advisory_xact_lock')) {
        return Promise.resolve({ rows: [{ lock_acquired: false }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .patch('/api/v1/appointments/apt-1/reschedule')
      .send({ newAppointmentDate: newDate });

    expect(response.status).toBe(429);
  });
});
