import request from 'supertest';
import express from 'express';
import invoicesRouter from './invoices';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

let mockUser: any = { id: 'secretary-user-id', role: 'SECRETARY', mustChangePassword: false };

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
  requireSecretaryPasswordChange: (req: any, res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (req: any, res: any, next: any) => next(),
}));

const { getClient } = require('../database/connection');

describe('Invoice edit (void + unlock)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/invoices', invoicesRouter);
    jest.clearAllMocks();
    mockUser = { id: 'secretary-user-id', role: 'SECRETARY', mustChangePassword: false };
  });

  const activeInvoice = {
    id: 'invoice-1',
    invoice_number: 'INV-0001',
    payment_id: 'payment-1',
    doctor_id: 'doctor-a',
    status: 'ACTIVE',
  };

  it('requires a reason before voiding the invoice', async () => {
    const mockClient = { query: jest.fn(), release: jest.fn() };
    getClient.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/v1/invoices/invoice-1/correct')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Correction reason is required');
    expect(mockClient.query).not.toHaveBeenCalledWith('BEGIN');
  });

  it('rejects editing an invoice for another doctor', async () => {
    const mockClient = { query: jest.fn(), release: jest.fn() };
    getClient.mockResolvedValue(mockClient);

    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return Promise.resolve();
      if (sql.includes('FROM secretaries')) {
        return Promise.resolve({ rows: [{ id: 'secretary-1', doctor_id: 'doctor-b' }] });
      }
      if (sql.includes('FROM invoices WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({ rows: [activeInvoice] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/invoices/invoice-1/correct')
      .send({ reason: 'Forgot item' });

    expect(response.status).toBe(403);
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('voids the invoice and writes INVOICE_VOIDED + INVOICE_UNLOCKED audit rows', async () => {
    const mockClient = { query: jest.fn(), release: jest.fn() };
    getClient.mockResolvedValue(mockClient);

    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('COMMIT')) return Promise.resolve();
      if (sql.includes('FROM secretaries')) {
        return Promise.resolve({ rows: [{ id: 'secretary-1', doctor_id: 'doctor-a' }] });
      }
      if (sql.includes('FROM invoices WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({ rows: [activeInvoice] });
      }
      if (sql.includes('UPDATE invoices SET status = \'VOID\'')) {
        return Promise.resolve({ rows: [{ ...activeInvoice, status: 'VOID' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/invoices/invoice-1/correct')
      .send({ reason: 'Forgot item', note: 'Missed dressing' });

    expect(response.status).toBe(200);

    const auditCalls = mockClient.query.mock.calls.filter(([sql]: [string]) =>
      sql.includes('INSERT INTO billing_audit_log')
    );
    const actions = auditCalls.map(([, params]: [string, any[]]) => params[2]);
    expect(actions).toEqual(['INVOICE_VOIDED', 'INVOICE_UNLOCKED']);

    const voidCall = mockClient.query.mock.calls.find(([sql]: [string]) =>
      sql.includes("UPDATE invoices SET status = 'VOID'")
    );
    expect(voidCall[1][1]).toBe('Forgot item — Missed dressing');
  });

  it('refuses to edit an invoice that is already voided', async () => {
    const mockClient = { query: jest.fn(), release: jest.fn() };
    getClient.mockResolvedValue(mockClient);

    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('BEGIN') || sql.includes('ROLLBACK')) return Promise.resolve();
      if (sql.includes('FROM secretaries')) {
        return Promise.resolve({ rows: [{ id: 'secretary-1', doctor_id: 'doctor-a' }] });
      }
      if (sql.includes('FROM invoices WHERE id = $1 FOR UPDATE')) {
        return Promise.resolve({ rows: [{ ...activeInvoice, status: 'VOID' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/invoices/invoice-1/correct')
      .send({ reason: 'Forgot item' });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('Invoice is not active');
  });
});
