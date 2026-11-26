/**
 * Tests for SuperAdmin role escalation guards on the admin API.
 * Verifies that ordinary ADMIN accounts cannot create or become SUPERADMIN
 * accounts: the admin-creation endpoint is SUPERADMIN-only, and even a
 * SUPERADMIN caller can only provision accounts with the hardcoded ADMIN role.
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import adminRouter from './admin';
import { config } from '../config';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/emailService', () => ({
  sendApprovalEmail: jest.fn(),
  sendRejectionEmail: jest.fn(),
}));

jest.mock('../services/otpService', () => ({
  ensureAdminSupabaseIdentity: jest.fn(),
}));

jest.mock('../services/auditService', () => ({
  logAdminCreation: jest.fn(),
}));

const { query } = require('../database/connection');
const { ensureAdminSupabaseIdentity } = require('../services/otpService');

function tokenFor(role: string) {
  return jwt.sign(
    { id: `${role.toLowerCase()}-id`, email: `${role.toLowerCase()}@example.com`, role },
    config.jwt.secret
  );
}

describe('Admin API - SuperAdmin escalation guards', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRouter);
    jest.clearAllMocks();
    ensureAdminSupabaseIdentity.mockResolvedValue(undefined);
  });

  it('rejects ADMIN tokens on SUPERADMIN-only endpoints with 403', async () => {
    const response = await request(app)
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${tokenFor('ADMIN')}`)
      .send({ email: 'newadmin@example.com', password: 'Sup3r$ecret!' });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('always creates ADMIN role even when the request body asks for SUPERADMIN', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO users')) {
        return Promise.resolve({
          rows: [{
            id: 'new-admin-id',
            email: 'requested@example.com',
            role: 'ADMIN',
            is_active: true,
            must_change_password: true,
            created_at: new Date().toISOString(),
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${tokenFor('SUPERADMIN')}`)
      .send({
        email: 'requested@example.com',
        password: 'Sup3r$ecret!',
        role: 'SUPERADMIN',
      });

    expect(response.status).toBe(201);

    const insertCall = query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO users')
    );
    expect(insertCall).toBeDefined();
    const [insertSql, params] = insertCall;
    // The role is the hardcoded 'ADMIN' literal passed as parameter $3; the
    // request body's "role" field is ignored entirely.
    expect(insertSql).toContain('role, is_active');
    expect(params[2]).toBe('ADMIN');
    expect(params).not.toContain('SUPERADMIN');
    expect(response.body.data.role).toBe('ADMIN');
  });
});
