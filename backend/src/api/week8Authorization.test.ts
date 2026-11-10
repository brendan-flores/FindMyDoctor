/**
 * Week 8 authorization hardening.
 *
 * Verification that clinic-operation and clinical-record endpoints are closed
 * to the ADMIN role (and SUPERADMIN, which is not part of any allowed-role
 * list) while the legitimate operational roles keep their access. The tests
 * mount the real routers with a mocked auth layer and a mocked database, in the
 * same style as the rest of the API test suite.
 */

import request from 'supertest';
import express from 'express';
import queueRouter from './queue';
import doctorsRouter from './doctors';
import paymentsRouter from './payments';
import invoicesRouter from './invoices';
import visitsRouter from './visits';
import scheduleChangesRouter from './scheduleChanges';

let mockUser: any = { id: 'admin-user-id', role: 'ADMIN', mustChangePassword: false };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    }
  },
  requirePasswordChange: (_req: any, _res: any, next: any) => next(),
  requireSecretaryPasswordChange: (_req: any, _res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../database/connection', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getClient: jest.fn(() => Promise.resolve({ query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() })),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn(),
}));

jest.mock('../services/storageService', () => ({
  uploadPaymentReceipt: jest.fn(),
  validatePaymentReceiptFile: jest.fn(),
  generateSignedReceiptUrl: jest.fn(),
}));

jest.mock('./notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  NotificationTypes: {
    PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
    PAYMENT_REJECTED: 'PAYMENT_REJECTED',
    NEW_SECRETARY_MESSAGE: 'NEW_SECRETARY_MESSAGE',
    NEW_PATIENT_MESSAGE: 'NEW_PATIENT_MESSAGE',
  },
}));

const DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440000';

function buildApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/queue', queueRouter);
  app.use('/api/v1/doctors', doctorsRouter);
  app.use('/api/v1/payments', paymentsRouter);
  app.use('/api/v1/invoices', invoicesRouter);
  app.use('/api/v1/visits', visitsRouter);
  app.use('/api/v1/schedule-changes', scheduleChangesRouter);
  return app;
}

describe('Week 8 authorization: admin has no clinic-operation access', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp();
    mockUser = { id: 'admin-user-id', role: 'ADMIN', mustChangePassword: false };
  });

  describe('queue', () => {
    it('denies admin the clinic queue with 403', async () => {
      const response = await request(app).get('/api/v1/queue/2026-11-10');
      expect(response.status).toBe(403);
    });

    it('denies admin a patient queue position with 403', async () => {
      const response = await request(app).get('/api/v1/queue/2026-11-10/patient/patient-1');
      expect(response.status).toBe(403);
    });

    it('still allows a doctor to read the clinic queue', async () => {
      mockUser = { id: 'doctor-user-id', role: 'DOCTOR', mustChangePassword: false };
      const response = await request(app).get('/api/v1/queue/2026-11-10');
      expect(response.status).toBe(200);
    });
  });

  describe('doctor capacity', () => {
    it('denies admin reading capacity with 403', async () => {
      const response = await request(app).get(
        `/api/v1/doctors/${DOCTOR_ID}/capacity?date=2026-11-10`
      );
      expect(response.status).toBe(403);
    });

    it('denies admin updating capacity with 403', async () => {
      const response = await request(app)
        .put(`/api/v1/doctors/${DOCTOR_ID}/capacity`)
        .send({ date: '2026-11-10', configuredCapacity: 5 });
      expect(response.status).toBe(403);
    });

    it('denies admin setting capacity for a date with 403', async () => {
      const response = await request(app)
        .post(`/api/v1/doctors/${DOCTOR_ID}/capacity/2026-11-10`)
        .send({ configuredCapacity: 5 });
      expect(response.status).toBe(403);
    });
  });

  describe('schedules', () => {
    it('denies admin creating a schedule with 403', async () => {
      const response = await request(app)
        .post('/api/v1/doctors/me/schedules')
        .send({ dayOfWeek: 1 });
      expect(response.status).toBe(403);
    });

    it('denies admin modifying a schedule with 403', async () => {
      const response = await request(app)
        .put('/api/v1/doctors/me/schedules/schedule-1')
        .send({ dayOfWeek: 1 });
      expect(response.status).toBe(403);
    });

    it('denies admin deleting a schedule with 403', async () => {
      const response = await request(app).delete('/api/v1/doctors/me/schedules/schedule-1');
      expect(response.status).toBe(403);
    });

    it('denies admin the secretary schedule-change inbox with 403', async () => {
      const response = await request(app).get('/api/v1/schedule-changes');
      expect(response.status).toBe(403);
    });

    it('denies admin confirming a schedule change with 403', async () => {
      const response = await request(app).post('/api/v1/schedule-changes/change-1/confirm');
      expect(response.status).toBe(403);
    });

    it('denies admin dismissing a schedule change with 403', async () => {
      const response = await request(app).post('/api/v1/schedule-changes/change-1/dismiss');
      expect(response.status).toBe(403);
    });
  });

  describe('payments', () => {
    it('denies admin the payment list with 403', async () => {
      const response = await request(app).get('/api/v1/payments');
      expect(response.status).toBe(403);
    });

    it('denies admin a payment by appointment with 403', async () => {
      const response = await request(app).get('/api/v1/payments/appointment-1');
      expect(response.status).toBe(403);
    });

    it('denies admin a payment by id with 403', async () => {
      const response = await request(app).get('/api/v1/payments/by-id/payment-1');
      expect(response.status).toBe(403);
    });

    it('denies admin verifying a payment with 403', async () => {
      const response = await request(app).patch('/api/v1/payments/payment-1/verify');
      expect(response.status).toBe(403);
    });
  });

  describe('invoices', () => {
    it('denies admin an invoice by id with 403', async () => {
      const response = await request(app).get('/api/v1/invoices/invoice-1');
      expect(response.status).toBe(403);
    });

    it('denies admin an invoice by payment with 403', async () => {
      const response = await request(app).get('/api/v1/invoices/by-payment/payment-1');
      expect(response.status).toBe(403);
    });

    it('denies admin the invoice PDF with 403', async () => {
      const response = await request(app).get('/api/v1/invoices/invoice-1/pdf');
      expect(response.status).toBe(403);
    });

    it('denies admin an invoice download URL with 403', async () => {
      const { query } = require('../database/connection');
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT i.*, m.conversation_id')) {
          return Promise.resolve({
            rows: [{ id: 'invoice-1', patient_id: 'patient-1', doctor_id: 'doctor-1', conversation_id: 'conversation-1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app).get('/api/v1/invoices/invoice-1/download-url');
      expect(response.status).toBe(403);
    });
  });

  describe('consultation / visit records', () => {
    it('denies admin reading a visit by id with 403', async () => {
      const response = await request(app).get('/api/v1/visits/visit-1');
      expect(response.status).toBe(403);
    });

    it('denies admin reading a visit by appointment with 403', async () => {
      const response = await request(app).get('/api/v1/visits/appointment/appointment-1');
      expect(response.status).toBe(403);
    });

    it('denies admin reading a patient visit history with 403', async () => {
      const response = await request(app).get('/api/v1/visits/patient/patient-1');
      expect(response.status).toBe(403);
    });
  });
});

describe('Week 8 authorization: patient ownership still enforced', () => {
  let app: express.Application;

  beforeEach(() => {
    app = buildApp();
  });

  it('returns 404 (not data) when a patient requests another patient visit', async () => {
    const { query } = require('../database/connection');
    query.mockImplementation((sql: string) => {
      if (sql.includes('FROM patients WHERE user_id')) {
        return Promise.resolve({ rows: [{ id: 'patient-1' }] });
      }
      if (sql.includes('FROM visits v')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    mockUser = { id: 'patient-user-1', role: 'PATIENT', mustChangePassword: false };
    const response = await request(app).get('/api/v1/visits/visit-owned-by-someone-else');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
