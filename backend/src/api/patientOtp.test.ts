/**
 * Tests for the patient OTP `/verify` endpoint.
 *
 * Focus: username uniqueness is enforced inside the account-creation
 * transaction (mirroring the email check), so a taken username returns a clear
 * `409 Conflict` ("Username already taken") instead of a raw database or
 * misleading verification error. Existing OTP verification behavior, the email
 * check, and the happy path are preserved.
 */

import request from 'supertest';
import express from 'express';
import patientOtpRouter from './patientOtp';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/patientOtpService', () => ({
  sendPatientSignupOtp: jest.fn(),
  verifyPatientOtpToken: jest.fn(),
}));

jest.mock('../modules/auth/authService', () => ({
  generateAccessToken: jest.fn(() => 'test-access-token'),
}));

const { query, getClient } = require('../database/connection');
const {
  sendPatientSignupOtp,
  verifyPatientOtpToken,
} = require('../services/patientOtpService');

const EMAIL = 'patient@example.com';
const USERNAME = 'juandc';

function pendingRow() {
  return {
    id: 1,
    email: EMAIL,
    password_hash: '$2a$10$storedhashvalue',
    first_name: 'Juan',
    middle_name: null,
    last_name: 'Dela Cruz',
    date_of_birth: '1990-01-01',
    sex: 'MALE',
    phone: '09171234567',
    address: 'Manila',
    username: USERNAME,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}

function clientWith(handler: (sql: string) => Promise<any> | void) {
  return {
    query: jest.fn((sql: string) => {
      const result = handler(sql);
      return result === undefined ? Promise.resolve({ rows: [] }) : result;
    }),
    release: jest.fn(),
  };
}

describe('Patient OTP /verify - username uniqueness', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth/patient/otp', patientOtpRouter);

    jest.clearAllMocks();
    verifyPatientOtpToken.mockResolvedValue({ verified: true });
    query.mockResolvedValue({ rows: [pendingRow()] });
  });

  it('returns 409 "Username already taken" when another account owns the username', async () => {
    const mockClient = clientWith((sql) => {
      if (sql.includes('SELECT id FROM users WHERE username')) {
        return Promise.resolve({ rows: [{ id: 'existing-user' }] });
      }
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/verify')
      .send({ email: EMAIL, otp: '123456' });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Username already taken');

    // The uniqueness check runs inside the transaction and the account is
    // never created.
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE username = $1',
      [USERNAME]
    );
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    const userInsertCalled = mockClient.query.mock.calls.some(
      (call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO users')
    );
    expect(userInsertCalled).toBe(false);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns 409 "Email already registered" when the email already exists', async () => {
    const mockClient = clientWith((sql) => {
      if (sql.includes('SELECT id FROM users WHERE email')) {
        return Promise.resolve({ rows: [{ id: 'existing-user' }] });
      }
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/verify')
      .send({ email: EMAIL, otp: '123456' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Email already registered');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('maps a username unique-violation race (23505) to a clear 409', async () => {
    const mockClient = clientWith((sql) => {
      if (sql.includes('INSERT INTO users')) {
        return Promise.reject({
          code: '23505',
          constraint: 'users_username_key',
          message:
            'duplicate key value violates unique constraint "users_username_key"',
        });
      }
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/verify')
      .send({ email: EMAIL, otp: '123456' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Username already taken');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('preserves OTP verification: an invalid OTP is rejected before any account work', async () => {
    verifyPatientOtpToken.mockResolvedValue({
      verified: false,
      error: 'Invalid or expired OTP code',
    });

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/verify')
      .send({ email: EMAIL, otp: '000000' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Invalid or expired OTP code');
    expect(getClient).not.toHaveBeenCalled();
  });

  it('creates the account when both the email and username are free', async () => {
    const mockClient = clientWith((sql) => {
      if (sql.includes('INSERT INTO users')) {
        return Promise.resolve({
          rows: [
            {
              id: 'user-1',
              email: EMAIL,
              role: 'PATIENT',
              must_change_password: false,
              email_verified: true,
              username: USERNAME,
            },
          ],
        });
      }

      if (sql.includes('INSERT INTO patients')) {
        return Promise.resolve({
          rows: [
            {
              id: 'patient-1',
              user_id: 'user-1',
              first_name: 'Juan',
              middle_name: null,
              last_name: 'Dela Cruz',
              date_of_birth: '1990-01-01',
              sex: 'MALE',
              phone: '09171234567',
              address: 'Manila',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        });
      }
    });
    getClient.mockResolvedValue(mockClient);

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/verify')
      .send({ email: EMAIL, otp: '123456' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accessToken).toBe('test-access-token');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
  });
});

describe('Patient OTP /send - up-front email and username checks', () => {
  let app: express.Application;

  function signupPayload(overrides: Record<string, unknown> = {}) {
    return {
      email: EMAIL,
      username: USERNAME,
      password: 'Password123',
      confirmPassword: 'Password123',
      firstName: 'Juan',
      middleName: 'D',
      lastName: 'Dela Cruz',
      dateOfBirth: '1990-01-01',
      sex: 'MALE',
      phone: '09171234567',
      address: 'Manila',
      ...overrides,
    };
  }

  // Answers the users-table lookups the way PostgreSQL would.
  function usersLookupExists(existing: { email?: boolean; username?: boolean } = {}) {
    query.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('FROM users WHERE email')) {
        return Promise.resolve({ rows: existing.email ? [{ id: 'existing-user' }] : [] });
      }
      if (typeof sql === 'string' && sql.includes('FROM users WHERE username')) {
        return Promise.resolve({ rows: existing.username ? [{ id: 'existing-user' }] : [] });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  function stagedSignup() {
    return query.mock.calls.some(
      (call: any[]) =>
        typeof call[0] === 'string' &&
        call[0].includes('INSERT INTO pending_patient_signups')
    );
  }

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth/patient/otp', patientOtpRouter);

    jest.clearAllMocks();
    sendPatientSignupOtp.mockResolvedValue({ message: 'OTP sent successfully' });
    query.mockResolvedValue({ rows: [] });
  });

  it('returns 409 "Username already taken" and sends no OTP when the username is taken', async () => {
    usersLookupExists({ username: true });

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/send')
      .send(signupPayload());

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Username already taken');

    // Nothing is staged and no OTP is sent, so the patient stays on the form.
    expect(sendPatientSignupOtp).not.toHaveBeenCalled();
    expect(stagedSignup()).toBe(false);
  });

  it('returns 409 "Email is already registered" and sends no OTP when the email is taken', async () => {
    usersLookupExists({ email: true });

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/send')
      .send(signupPayload());

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Email is already registered');
    expect(sendPatientSignupOtp).not.toHaveBeenCalled();
    expect(stagedSignup()).toBe(false);
  });

  it('checks the email before the username', async () => {
    usersLookupExists({ email: true, username: true });

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/send')
      .send(signupPayload());

    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe('Email is already registered');
    expect(query).not.toHaveBeenCalledWith('SELECT id FROM users WHERE username = $1', [
      USERNAME,
    ]);
  });

  it('stages the sign-up and sends the OTP when both the email and username are free', async () => {
    usersLookupExists({});

    const response = await request(app)
      .post('/api/v1/auth/patient/otp/send')
      .send(signupPayload());

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(query).toHaveBeenCalledWith('SELECT id FROM users WHERE username = $1', [USERNAME]);
    expect(stagedSignup()).toBe(true);
    expect(sendPatientSignupOtp).toHaveBeenCalledWith(EMAIL);
  });
});
