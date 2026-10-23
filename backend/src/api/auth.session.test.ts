/**
 * Session policy, trusted-device, and portal-scoped cookie tests.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import authRouter from './auth';
import { config } from '../config';
import { getSessionPolicy, buildSessionResponse } from '../modules/auth/sessionPolicy';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/otpService', () => ({
  sendLoginOtp: jest.fn(),
  verifyLoginOtp: jest.fn(),
}));

const { query } = require('../database/connection');
const { sendLoginOtp, verifyLoginOtp: verifyLoginOtpService } = require('../services/otpService');

function setCookieHeader(response: request.Response): string[] {
  const header = response.headers['set-cookie'];
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function findCookie(cookies: string[], name: string): string | undefined {
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRouter);
  return app;
}

function doctorUserRow(twoFactorEnabled: boolean) {
  return {
    id: 'doctor-id',
    email: 'doctor@example.com',
    password_hash: '$2a$10$hashedpassword',
    role: 'DOCTOR',
    is_active: true,
    must_change_password: false,
    session_version: 0,
    two_factor_enabled: twoFactorEnabled,
  };
}

function mockDoctorUser(twoFactorEnabled: boolean) {
  query.mockImplementation((sql: string) => {
    if (sql.includes('SELECT * FROM users')) {
      return Promise.resolve({
        rows: [doctorUserRow(twoFactorEnabled)],
      });
    }
    if (sql.includes('SELECT approval_status FROM doctors')) {
      return Promise.resolve({ rows: [{ approval_status: 'ACTIVE' }] });
    }
    if (sql.includes('SELECT two_factor_enabled FROM doctors')) {
      return Promise.resolve({ rows: [{ two_factor_enabled: twoFactorEnabled }] });
    }
    if (sql.includes('SELECT * FROM trusted_browsers')) {
      return Promise.resolve({ rows: [{ id: 'trusted-browser-id' }] });
    }
    if (sql.includes('UPDATE trusted_browsers')) {
      return Promise.resolve({ rows: [{ id: 'trusted-browser-id' }] });
    }
    if (sql.includes('INSERT INTO trusted_browsers')) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

function signDoctorRefreshToken(): string {
  return jwt.sign(
    {
      id: 'doctor-id',
      email: 'doctor@example.com',
      role: 'DOCTOR',
      typ: 'refresh',
      sv: 0,
      sst: Date.now(),
      remember: false,
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

function signDoctorAccessToken(mustChangePassword = false): string {
  return jwt.sign(
    {
      id: 'doctor-id',
      email: 'doctor@example.com',
      role: 'DOCTOR',
      mustChangePassword,
      sv: 0,
      sst: Date.now(),
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

function signPatientAccessToken(): string {
  return jwt.sign(
    {
      id: 'patient-id',
      email: 'patient@example.com',
      role: 'PATIENT',
      mustChangePassword: false,
      sv: 0,
      sst: Date.now(),
    },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

describe('Session policy', () => {
  it('keeps untrusted staff sessions non-persistent with an 8-hour idle window', () => {
    const policy = getSessionPolicy('DOCTOR', false);
    expect(policy.persistent).toBe(false);
    expect(policy.idleTimeoutSec).toBe(8 * 60 * 60);
    expect(policy.absoluteTimeoutSec).toBeNull();
    expect(policy.trustedBrowserAllowed).toBe(true);
  });

  it('gives trusted staff devices a 30-day persistent session', () => {
    const policy = getSessionPolicy('SECRETARY', true);
    expect(policy.persistent).toBe(true);
    expect(policy.refreshExpiresInSec).toBe(30 * 24 * 60 * 60);
    expect(policy.absoluteTimeoutSec).toBe(30 * 24 * 60 * 60);
    expect(policy.trustedBrowserAllowed).toBe(true);
  });

  it('forces short, non-persistent admin sessions without trusted devices', () => {
    const policy = getSessionPolicy('ADMIN', true);
    expect(policy.persistent).toBe(false);
    expect(policy.idleTimeoutSec).toBe(2 * 60 * 60);
    expect(policy.absoluteTimeoutSec).toBe(8 * 60 * 60);
    expect(policy.trustedBrowserAllowed).toBe(false);
  });

  it('preserves the existing patient lifetime', () => {
    const policy = getSessionPolicy('PATIENT', false);
    expect(policy.persistent).toBe(true);
    expect(policy.accessExpiresInSec).toBe(7 * 24 * 60 * 60);
    expect(policy.refreshExpiresInSec).toBe(30 * 24 * 60 * 60);
  });

  it('builds session metadata for the client watchdog', () => {
    expect(buildSessionResponse('ADMIN', false)).toEqual({
      rememberMe: false,
      persistent: false,
      idleTimeoutMinutes: 120,
      maxSessionMinutes: 480,
    });
  });
});

describe('Auth routes - session behavior', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  it('requires OTP for every admin login and never sets a trusted device', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM users')) {
        return Promise.resolve({
          rows: [{
            id: 'admin-id',
            email: 'admin@example.com',
            password_hash: '$2a$10$hashedpassword',
            role: 'ADMIN',
            is_active: true,
            must_change_password: false,
            session_version: 0,
          }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@example.com', password: 'password123', expectedRole: 'ADMIN' });

    expect(response.status).toBe(200);
    expect(response.body.data.requiresOtp).toBe(true);
    expect(response.body.data.requiresTrustPrompt).toBe(false);
    expect(findCookie(setCookieHeader(response), 'admin_trustedBrowser')).toBeUndefined();
  });

  it('sets a short, non-persistent session and requires the trust prompt for a new staff browser', async () => {
    mockDoctorUser(false);
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@example.com', password: 'password123', expectedRole: 'DOCTOR' });

    expect(response.status).toBe(200);
    expect(response.body.data.isTrustedBrowser).toBe(false);
    expect(response.body.data.requiresTrustPrompt).toBe(true);
    expect(response.body.data.session.persistent).toBe(false);

    const cookies = setCookieHeader(response);
    const access = findCookie(cookies, 'doctor_accessToken');
    const refresh = findCookie(cookies, 'doctor_refreshToken');

    expect(access).toBeDefined();
    expect(refresh).toBeDefined();
    expect(access).not.toContain('Max-Age');
    expect(refresh).not.toContain('Max-Age');
    expect(findCookie(cookies, 'doctor_sessionActive')).toBeDefined();
    // A new/untrusted browser must not retain a stale trusted-device cookie.
    expect(findCookie(cookies, 'doctor_trustedBrowser')).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('skips OTP and sets persistent cookies when the trusted-device cookie is valid', async () => {
    mockDoctorUser(true);
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', 'doctor_trustedBrowser=existing-trusted-token')
      .send({ email: 'doctor@example.com', password: 'password123', expectedRole: 'DOCTOR' });

    expect(response.status).toBe(200);
    expect(response.body.data.requiresOtp).toBeUndefined();
    expect(response.body.data.isTrustedBrowser).toBe(true);
    expect(response.body.data.requiresTrustPrompt).toBe(false);
    expect(response.body.data.session.persistent).toBe(true);
    expect(response.body.data.session.idleTimeoutMinutes).toBe(30 * 24 * 60);

    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).toContain('Max-Age');
    expect(findCookie(cookies, 'doctor_refreshToken')).toContain('Max-Age');
    expect(findCookie(cookies, 'doctor_trustedBrowser')).toContain('HttpOnly');
  });

  it('does not return the trusted-device token in the JSON body', async () => {
    mockDoctorUser(false);
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Cookie', 'doctor_trustedBrowser=existing-trusted-token')
      .send({ email: 'doctor@example.com', password: 'password123', expectedRole: 'DOCTOR' });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('trustedBrowserToken');
  });

  it('sends an OTP for an untrusted browser when staff have 2FA enabled', async () => {
    mockDoctorUser(true);
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'doctor@example.com', password: 'password123', expectedRole: 'DOCTOR' });

    expect(response.status).toBe(200);
    expect(response.body.data.requiresOtp).toBe(true);
    expect(response.body.data.rememberMe).toBe(false);
    expect(response.body.data.requiresTrustPrompt).toBe(true);
    expect(sendLoginOtp).toHaveBeenCalledWith('doctor@example.com');
  });

  it('does not let a legacy rememberMe request bypass OTP on a new browser', async () => {
    mockDoctorUser(true);
    const bcrypt = require('bcryptjs');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'doctor@example.com',
        password: 'password123',
        expectedRole: 'DOCTOR',
        rememberMe: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.requiresOtp).toBe(true);
    expect(response.body.data.requiresTrustPrompt).toBe(true);
  });

  it('does not auto-trust the browser when OTP verification succeeds', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM login_otp_challenges')) {
        return Promise.resolve({
          rows: [{
            id: 'challenge-id',
            user_id: 'doctor-id',
            email: 'doctor@example.com',
            remember_me: true,
          }],
        });
      }
      if (sql.includes('UPDATE login_otp_challenges')) {
        return Promise.resolve({ rows: [{ id: 'challenge-id' }] });
      }
      if (sql.includes('SELECT * FROM users')) {
        return Promise.resolve({ rows: [doctorUserRow(true)] });
      }
      return Promise.resolve({ rows: [] });
    });
    verifyLoginOtpService.mockResolvedValue({ verified: true });

    const response = await request(app)
      .post('/api/v1/auth/verify-login-otp')
      .send({ challengeId: 'challenge-token', otp: '123456' });

    expect(response.status).toBe(200);
    expect(response.body.data.isTrustedBrowser).toBe(false);
    expect(response.body.data.requiresTrustPrompt).toBe(true);
    expect(response.body.data.session.persistent).toBe(false);

    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).not.toContain('Max-Age');
    expect(findCookie(cookies, 'doctor_trustedBrowser')).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('registers the current browser and upgrades it to a 30-day trusted session', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM users')) {
        return Promise.resolve({ rows: [doctorUserRow(false)] });
      }
      if (sql.includes('INSERT INTO trusted_browsers')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const response = await request(app)
      .post('/api/v1/auth/trusted-browsers/trust-current')
      .set('Authorization', `Bearer ${signDoctorAccessToken()}`)
      .set('X-Portal-Role', 'doctor')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.isTrustedBrowser).toBe(true);
    expect(response.body.data.requiresTrustPrompt).toBe(false);
    expect(response.body.data.session.persistent).toBe(true);
    expect(response.body.data.session.idleTimeoutMinutes).toBe(30 * 24 * 60);
    expect(JSON.stringify(response.body)).not.toContain('trustedBrowserToken');

    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).toContain('Max-Age');
    expect(findCookie(cookies, 'doctor_refreshToken')).toContain('Max-Age');
    expect(findCookie(cookies, 'doctor_trustedBrowser')).toContain('HttpOnly');
    expect(findCookie(cookies, 'doctor_sessionActive')).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('rejects trust-current for a non-staff account', async () => {
    const response = await request(app)
      .post('/api/v1/auth/trusted-browsers/trust-current')
      .set('Authorization', `Bearer ${signPatientAccessToken()}`)
      .set('X-Portal-Role', 'patient')
      .send({});

    expect(response.status).toBe(403);
  });

  it('rejects trust-current while a password change is still required', async () => {
    const response = await request(app)
      .post('/api/v1/auth/trusted-browsers/trust-current')
      .set('Authorization', `Bearer ${signDoctorAccessToken(true)}`)
      .set('X-Portal-Role', 'doctor')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('MUST_CHANGE_PASSWORD');
  });

  it('returns the current request device details without secrets', async () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DoctorTestBrowser/1.0';

    const response = await request(app)
      .get('/api/v1/auth/trusted-browsers/current-device')
      .set('Authorization', `Bearer ${signDoctorAccessToken()}`)
      .set('X-Portal-Role', 'doctor')
      .set('User-Agent', userAgent);

    expect(response.status).toBe(200);
    expect(response.body.data.deviceInfo).toBe(userAgent);
    expect(response.body.data.capturedAt).toBeDefined();
    expect(JSON.stringify(response.body)).not.toContain('token');
  });

  it('scopes logout to the portal in the request body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .send({ role: 'doctor' });

    expect(response.status).toBe(200);
    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).toBeDefined();
    expect(findCookie(cookies, 'doctor_refreshToken')).toBeDefined();
    expect(findCookie(cookies, 'secretary_accessToken')).toBeUndefined();
  });

  it('rejects a refresh request without a token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({});

    expect(response.status).toBe(400);
  });

  it('refreshes with the doctor refresh cookie and leaves other portals untouched', async () => {
    mockDoctorUser(false);

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `doctor_refreshToken=${signDoctorRefreshToken()}`)
      .send({ role: 'doctor' });

    expect(response.status).toBe(200);
    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).toBeDefined();
    expect(findCookie(cookies, 'doctor_refreshToken')).toBeDefined();
    expect(findCookie(cookies, 'secretary_accessToken')).toBeUndefined();
  });

  it('does not read a refresh token from another portal cookie', async () => {
    mockDoctorUser(false);

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `secretary_refreshToken=${signDoctorRefreshToken()}`)
      .send({ role: 'doctor' });

    expect(response.status).toBe(400);
  });

  it('clears only the doctor cookies when a doctor refresh fails', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'doctor_refreshToken=not-a-real-token')
      .send({ role: 'doctor' });

    expect(response.status).toBe(401);
    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).toContain('Expires=Thu, 01 Jan 1970');
    expect(findCookie(cookies, 'doctor_refreshToken')).toContain('Expires=Thu, 01 Jan 1970');
    expect(findCookie(cookies, 'secretary_accessToken')).toBeUndefined();
  });

  it('signs out of all devices by bumping session_version and clearing only doctor cookies', async () => {
    const statements: string[] = [];
    query.mockImplementation((sql: string) => {
      statements.push(sql);
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    const response = await request(app)
      .post('/api/v1/auth/trusted-browsers/revoke-all')
      .set('Authorization', `Bearer ${signDoctorAccessToken()}`)
      .set('X-Portal-Role', 'doctor')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: null,
      message: 'Signed out of all devices',
    });
    expect(
      statements.some((sql) =>
        sql.includes('UPDATE users SET session_version = session_version + 1')
      )
    ).toBe(true);
    expect(
      statements.some((sql) => sql.includes('UPDATE trusted_browsers'))
    ).toBe(true);

    const cookies = setCookieHeader(response);
    expect(findCookie(cookies, 'doctor_accessToken')).toContain('Expires=Thu, 01 Jan 1970');
    expect(findCookie(cookies, 'doctor_refreshToken')).toContain('Expires=Thu, 01 Jan 1970');
    expect(findCookie(cookies, 'doctor_sessionActive')).toContain('Expires=Thu, 01 Jan 1970');
    expect(findCookie(cookies, 'doctor_trustedBrowser')).toContain('Expires=Thu, 01 Jan 1970');
    expect(findCookie(cookies, 'secretary_accessToken')).toBeUndefined();
    expect(findCookie(cookies, 'admin_accessToken')).toBeUndefined();
    expect(findCookie(cookies, 'patient_accessToken')).toBeUndefined();
  });
});
