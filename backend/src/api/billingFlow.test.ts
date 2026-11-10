/**
 * Billing flow verification.
 *
 * Verifies the documented money flow end to end at the endpoint level:
 *   prescription (doctor) → medicine charge (secretary, priced by secretary)
 *   → payment verification → invoice generation → invoice chat delivery
 *   → patient invoice download.
 *
 * The database is mocked per stage (the repo has no live-PostgreSQL harness),
 * so each test asserts the state transition the next stage depends on.
 */

import request from 'supertest';
import express from 'express';
import prescriptionsRouter from './prescriptions';
import paymentsRouter from './payments';
import invoicesRouter from './invoices';
import conversationsRouter from './conversations';

let mockUser: any = { id: 'doctor-user-1', role: 'DOCTOR', mustChangePassword: false };

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
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/billingService', () => ({
  recalculateBill: jest.fn().mockResolvedValue('PARTIAL'),
  logBillingAction: jest.fn().mockResolvedValue(undefined),
  getBillingSummary: jest.fn(),
  getPaymentWithBilling: jest.fn(),
}));

jest.mock('../services/invoicePdfService', () => ({
  generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 test invoice')),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/storageService', () => ({
  uploadPaymentReceipt: jest.fn(),
  validatePaymentReceiptFile: jest.fn(),
  generateSignedReceiptUrl: jest.fn(),
}));

jest.mock('./notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  NotificationTypes: {
    PRESCRIPTION_AVAILABLE: 'PRESCRIPTION_AVAILABLE',
    PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
    PAYMENT_REJECTED: 'PAYMENT_REJECTED',
    ADDITIONAL_CHARGE_ADDED: 'ADDITIONAL_CHARGE_ADDED',
  },
}));

jest.mock('../modules/conversations/conversationService', () => ({
  getAuthorizedConversation: jest.fn(),
  notifyMessageRecipients: jest.fn().mockResolvedValue(undefined),
  notifyInvoiceRecipients: jest.fn().mockResolvedValue(undefined),
}));

const { query, getClient } = require('../database/connection');
const { createNotification } = require('./notifications');
const { notifyInvoiceRecipients, getAuthorizedConversation } = require('../modules/conversations/conversationService');
const { generateInvoicePdf } = require('../services/invoicePdfService');

const PAYMENT = {
  id: 'payment-1',
  appointment_id: 'appointment-1',
  patient_id: 'patient-1',
  patient_user_id: 'patient-user-1',
  doctor_id: 'doctor-1',
  consultation_amount: '500.00',
  total_additional_charges: '75.00',
  total_amount: '575.00',
  amount_paid: '575.00',
  gcash_advance_amount: '0.00',
  cash_tendered_amount: '575.00',
  payment_method: 'CASH',
  status: 'PAID',
  appointment_date: '2026-11-10T00:00:00.000Z',
  reason_for_visit: 'Fever',
  patient_first_name: 'Juan',
  patient_last_name: 'Dela Cruz',
  patient_phone: '09171234567',
  patient_address: 'Manila',
  patient_dob: '1990-01-01',
  patient_sex: 'MALE',
  patient_email: 'juan@example.com',
  doctor_first_name: 'Maria',
  doctor_last_name: 'Santos',
  specialty: 'General Medicine',
  practice_name: 'Santos Clinic',
  consultation_fee: '500.00',
};

const INVOICE = {
  id: 'invoice-1',
  invoice_number: 'INV-0001',
  payment_id: 'payment-1',
  doctor_id: 'doctor-1',
  patient_id: 'patient-1',
  invoice_date: '2026-11-10T00:00:00.000Z',
  status: 'ACTIVE',
  subtotal: '575.00',
  total_amount: '575.00',
  invoice_data: JSON.stringify({
    clinic: { name: 'Santos Clinic', address: '', contact_number: '', footer_line: 'Thank you!' },
    charges: [{ charge_type: 'MEDICINE', description: 'Paracetamol', amount: 75, quantity: 3, unit_price: 25 }],
    payment: {},
  }),
};

function makeClient(handler: (sql: string, params: any[]) => any) {
  return {
    query: jest.fn((sql: string, params: any[]) => Promise.resolve(handler(sql, params) ?? { rows: [] })),
    release: jest.fn(),
  };
}

describe('Billing flow', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/prescriptions', prescriptionsRouter);
    app.use('/api/v1/payments', paymentsRouter);
    app.use('/api/v1/invoices', invoicesRouter);
    app.use('/api/v1/conversations', conversationsRouter);
    jest.clearAllMocks();
    mockUser = { id: 'doctor-user-1', role: 'DOCTOR', mustChangePassword: false };
  });

  it('stage 1: doctor issues a prescription with medicine items', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM visits WHERE id')) {
        return Promise.resolve({ rows: [{ id: 'visit-1', patient_id: 'patient-1', doctor_id: 'doctor-1' }] });
      }
      if (sql.includes('INSERT INTO prescriptions')) {
        return Promise.resolve({ rows: [{ id: 'prescription-1', patient_id: 'patient-1', doctor_id: 'doctor-1' }] });
      }
      if (sql.includes('INSERT INTO prescription_items')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('SELECT user_id FROM patients')) {
        return Promise.resolve({ rows: [{ user_id: 'patient-user-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/prescriptions')
      .send({
        visitId: 'visit-1',
        items: [
          { medicationName: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours', duration: '3 days' },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe('prescription-1');
    expect(createNotification).toHaveBeenCalledWith(
      'patient-user-1',
      'PRESCRIPTION_AVAILABLE',
      expect.any(String),
      expect.any(String),
      'prescription',
      'prescription-1'
    );
  });

  it('stage 2: secretary prices a medicine charge from the prescription item', async () => {
    mockUser = { id: 'secretary-user-1', role: 'SECRETARY', mustChangePassword: false };

    const mockClient = makeClient((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [] };
      if (sql.includes('SELECT id, doctor_id FROM secretaries')) {
        return { rows: [{ id: 'secretary-1', doctor_id: 'doctor-1' }] };
      }
      if (sql.includes('SELECT p.*, a.doctor_id') && sql.includes('FOR UPDATE')) {
        return { rows: [{ ...PAYMENT, status: 'UNPAID', total_amount: '500.00', total_additional_charges: '0.00', amount_paid: '0.00' }] };
      }
      if (sql.includes('SELECT id, invoice_number FROM invoices')) {
        return { rows: [] };
      }
      if (sql.includes('FROM prescription_items pi')) {
        return {
          rows: [
            {
              id: 'item-1',
              patient_id: 'patient-1',
              doctor_id: 'doctor-1',
              appointment_id: 'appointment-1',
              prescription_id: 'prescription-1',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO payment_charges')) {
        return { rows: [{ id: 'charge-1' }] };
      }
      if (sql.includes('SELECT COALESCE(SUM(amount)::numeric, 0)')) {
        return { rows: [{ total_charges: '75.00' }] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/v1/payments/payment-1/charges')
      .send({
        chargeType: 'MEDICINE',
        name: 'Paracetamol 500mg',
        quantity: 3,
        unitPrice: 25,
        prescriptionItemId: 'item-1',
      });

    expect(response.status).toBe(200);
    // Server computes qty × unit price; it never trusts a client line total.
    expect(response.body.data.chargeAmount).toBe(75);
    expect(response.body.data.totalAmount).toBe(575);
    expect(response.body.data.status).toBe('PARTIAL');

    const insert = mockClient.query.mock.calls.find((call: any[]) =>
      String(call[0]).includes('INSERT INTO payment_charges')
    );
    expect(insert).toBeTruthy();
    expect(insert[1]).toEqual([
      'payment-1',
      'MEDICINE',
      'Paracetamol 500mg',
      75,
      3,
      25,
      'item-1',
      'secretary-1',
    ]);
  });

  it('stage 3: secretary verifies a GCash receipt (payment stays pending until mark-paid)', async () => {
    mockUser = { id: 'secretary-user-1', role: 'SECRETARY', mustChangePassword: false };

    const mockClient = makeClient((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [] };
      if (sql.includes('SELECT id, doctor_id FROM secretaries')) {
        return { rows: [{ id: 'secretary-1', doctor_id: 'doctor-1' }] };
      }
      if (sql.includes('SELECT p.*, a.doctor_id') && sql.includes('FOR UPDATE')) {
        return { rows: [{ ...PAYMENT, status: 'PENDING_VERIFICATION', payment_method: 'GCASH' }] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app).patch('/api/v1/payments/payment-1/verify');

    expect(response.status).toBe(200);
    expect(createNotification).toHaveBeenCalledWith(
      'patient-user-1',
      'PAYMENT_VERIFIED',
      expect.any(String),
      expect.any(String),
      'payment',
      'payment-1'
    );
  });

  it('stage 4: secretary generates an invoice for the fully paid bill', async () => {
    mockUser = { id: 'secretary-user-1', role: 'SECRETARY', mustChangePassword: false };

    const mockClient = makeClient((sql) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return { rows: [] };
      if (sql.includes('SELECT id, doctor_id FROM secretaries')) {
        return { rows: [{ id: 'secretary-1', doctor_id: 'doctor-1' }] };
      }
      if (sql.includes('SELECT p.*') && sql.includes('FOR UPDATE')) {
        return { rows: [PAYMENT] };
      }
      if (sql.includes('SELECT id, status FROM invoices')) {
        return { rows: [] };
      }
      if (sql.includes('FROM invoice_settings')) {
        return { rows: [{ clinic_name: 'Santos Clinic', address: '', contact_number: '', footer_line: 'Thank you!' }] };
      }
      if (sql.includes('SELECT pc.charge_type')) {
        return {
          rows: [
            { charge_type: 'MEDICINE', description: 'Paracetamol', amount: '75.00', quantity: '3', unit_price: '25.00' },
          ],
        };
      }
      if (sql.includes('SELECT invoice_number FROM invoices')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO invoices')) {
        return { rows: [INVOICE] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app).post('/api/v1/invoices/generate/payment-1');

    expect(response.status).toBe(200);
    expect(response.body.data.invoice_number).toBe('INV-0001');
    expect(response.body.data.invoice_data.charges[0].description).toBe('Paracetamol');
    expect(response.body.data.invoice_data.payment.total_amount).toBe(575);
  });

  it('stage 4 guard: invoice generation is refused while a balance remains', async () => {
    mockUser = { id: 'secretary-user-1', role: 'SECRETARY', mustChangePassword: false };

    const mockClient = makeClient((sql) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return { rows: [] };
      if (sql.includes('SELECT id, doctor_id FROM secretaries')) {
        return { rows: [{ id: 'secretary-1', doctor_id: 'doctor-1' }] };
      }
      if (sql.includes('SELECT p.*') && sql.includes('FOR UPDATE')) {
        return { rows: [{ ...PAYMENT, status: 'PAID', amount_paid: '400.00' }] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app).post('/api/v1/invoices/generate/payment-1');

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('remaining balance');
  });

  it('stage 5: secretary delivers the invoice through the patient–secretary conversation', async () => {
    mockUser = { id: 'secretary-user-1', role: 'SECRETARY', mustChangePassword: false };

    getAuthorizedConversation.mockResolvedValue({
      id: 'conversation-1',
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
    });

    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT i.invoice_number, i.id')) {
        return Promise.resolve({ rows: [{ invoice_number: 'INV-0001', id: 'invoice-1' }] });
      }
      if (sql.includes('INSERT INTO messages')) {
        return Promise.resolve({ rows: [{ id: 'message-1', message_type: 'INVOICE', invoice_id: 'invoice-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/conversations/conversation-1/messages')
      .send({ messageType: 'INVOICE', invoiceId: 'invoice-1' });

    expect(response.status).toBe(201);
    expect(response.body.data.invoice).toEqual({ id: 'invoice-1', invoice_number: 'INV-0001' });
    expect(notifyInvoiceRecipients).toHaveBeenCalledWith(
      'secretary-user-1',
      expect.objectContaining({ id: 'conversation-1' }),
      'invoice-1'
    );
  });

  it('stage 6: patient gets a signed download URL and downloads the invoice PDF', async () => {
    mockUser = { id: 'patient-user-1', role: 'PATIENT', mustChangePassword: false };

    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT i.*, m.conversation_id')) {
        return Promise.resolve({ rows: [{ ...INVOICE, conversation_id: 'conversation-1' }] });
      }
      if (sql.includes('SELECT 1 FROM patients WHERE id = $1 AND user_id = $2')) {
        return Promise.resolve({ rows: [{ '?column?': 1 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const urlResponse = await request(app).get('/api/v1/invoices/invoice-1/download-url');

    expect(urlResponse.status).toBe(200);
    const downloadUrl: string = urlResponse.body.data.downloadUrl;
    expect(downloadUrl).toContain('/api/v1/invoices/invoice-1/download?token=');

    // The public download endpoint is token-gated and renders a PDF.
    const mockClient = makeClient((sql) => {
      if (sql.includes('SELECT i.*, p.gcash_advance_amount')) {
        return { rows: [{ ...INVOICE, gcash_advance_amount: '0.00', cash_tendered_amount: '575.00', amount_paid: '575.00' }] };
      }
      return { rows: [] };
    });
    getClient.mockResolvedValue(mockClient);

    const parsed = new URL(downloadUrl);
    const pdfResponse = await request(app).get(`${parsed.pathname}${parsed.search}`);

    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(generateInvoicePdf).toHaveBeenCalled();
  });

  it('stage 6 guard: an invalid download token is rejected', async () => {
    mockUser = { id: 'patient-user-1', role: 'PATIENT', mustChangePassword: false };
    getClient.mockResolvedValue(makeClient(() => ({ rows: [] })));

    const response = await request(app).get('/api/v1/invoices/invoice-1/download?token=not-a-token');

    expect(response.status).toBe(401);
  });
});
