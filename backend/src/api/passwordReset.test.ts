import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import passwordResetRouter from './passwordReset';
import { config } from '../config';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/otpService', () => ({
  sendPasswordResetOtp: jest.fn(),
  verifyPasswordResetOtp: jest.fn(),
  ensureUserSupabaseIdentity: jest.fn(),
}));

const { query } = require('../database/connection');
const { verifyPasswordResetOtp } = require('../services/otpService');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth/password-reset', passwordResetRouter);
  return app;
}

describe('Password Reset API - Two-Step Verification Flow', () => {
  const app = createApp();

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    role: 'DOCTOR',
    session_version: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/password-reset/verify', () => {
    it('rejects missing or invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/password-reset/verify')
        .send({ email: 'not-an-email', otp: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Valid email is required');
    });

    it('rejects OTP that is not 6 digits', async () => {
      const res = await request(app)
        .post('/api/v1/auth/password-reset/verify')
        .send({ email: 'user@example.com', otp: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Valid 6-digit verification code is required');
    });

    it('returns 404 when user does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/auth/password-reset/verify')
        .send({ email: 'nonexistent@example.com', otp: '123456' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('User not found');
    });

    it('returns 400 when OTP verification fails in Supabase', async () => {
      query.mockResolvedValueOnce({ rows: [mockUser] });
      verifyPasswordResetOtp.mockResolvedValueOnce({ verified: false, error: 'Invalid or expired OTP code' });

      const res = await request(app)
        .post('/api/v1/auth/password-reset/verify')
        .send({ email: 'user@example.com', otp: '999999' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid or expired');
    });

    it('returns 200 and a valid resetToken when OTP is verified', async () => {
      query.mockResolvedValueOnce({ rows: [mockUser] });
      verifyPasswordResetOtp.mockResolvedValueOnce({ verified: true });

      const res = await request(app)
        .post('/api/v1/auth/password-reset/verify')
        .send({ email: 'user@example.com', otp: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resetToken).toBeDefined();

      // Verify the issued token structure
      const decoded: any = jwt.verify(res.body.data.resetToken, config.jwt.secret);
      expect(decoded.email).toBe('user@example.com');
      expect(decoded.userId).toBe('user-123');
      expect(decoded.purpose).toBe('password_reset');
      expect(decoded.sessionVersion).toBe(3);
    });
  });

  describe('POST /api/v1/auth/password-reset/reset', () => {
    it('rejects attempt to reset without resetToken (cannot bypass verification)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/password-reset/reset')
        .send({
          email: 'user@example.com',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Verification token is required');
    });

    it('rejects reset with invalid resetToken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/password-reset/reset')
        .send({
          email: 'user@example.com',
          resetToken: 'invalid.jwt.token',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid or expired reset token');
    });

    it('rejects reset if password is shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/password-reset/reset')
        .send({
          email: 'user@example.com',
          resetToken: 'some-token',
          newPassword: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('New password must be at least 8 characters');
    });

    it('rejects reset if token email does not match requested email', async () => {
      const mismatchToken = jwt.sign(
        {
          userId: 'user-123',
          email: 'other@example.com',
          sessionVersion: 3,
          purpose: 'password_reset',
        },
        config.jwt.secret,
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .post('/api/v1/auth/password-reset/reset')
        .send({
          email: 'user@example.com',
          resetToken: mismatchToken,
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid reset token');
    });

    it('rejects reset if token session_version does not match current user session_version (replay attack)', async () => {
      const staleToken = jwt.sign(
        {
          userId: 'user-123',
          email: 'user@example.com',
          sessionVersion: 2, // User is currently at session_version 3
          purpose: 'password_reset',
        },
        config.jwt.secret,
        { expiresIn: '15m' }
      );

      query.mockResolvedValueOnce({ rows: [mockUser] });

      const res = await request(app)
        .post('/api/v1/auth/password-reset/reset')
        .send({
          email: 'user@example.com',
          resetToken: staleToken,
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Reset token has already been used or expired');
    });

    it('successfully resets password and increments session_version', async () => {
      const validToken = jwt.sign(
        {
          userId: 'user-123',
          email: 'user@example.com',
          sessionVersion: 3,
          purpose: 'password_reset',
        },
        config.jwt.secret,
        { expiresIn: '15m' }
      );

      query
        .mockResolvedValueOnce({ rows: [mockUser] }) // User lookup
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE users query

      const res = await request(app)
        .post('/api/v1/auth/password-reset/reset')
        .send({
          email: 'user@example.com',
          resetToken: validToken,
          newPassword: 'BrandNewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('Password has been reset successfully');

      // Verify DB update was executed with session_version increment and must_change_password = false
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([expect.any(String), 'user-123'])
      );
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('session_version = session_version + 1'),
        expect.any(Array)
      );
    });
  });
});
