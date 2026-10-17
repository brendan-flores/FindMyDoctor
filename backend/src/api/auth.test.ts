/**
 * Tests for auth API endpoint - patient login validation
 * These tests verify that the login endpoint correctly validates expectedRole for PATIENT
 * and handles role mismatches appropriately
 */

import request from 'supertest';
import express from 'express';
import authRouter from './auth';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/otpService', () => ({
  sendLoginOtp: jest.fn(),
}));

const { query } = require('../database/connection');
const { sendLoginOtp } = require('../services/otpService');

describe('Auth API - Patient Login Validation', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should accept PATIENT in expectedRole validation', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'test-patient-id',
              email: 'patient@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      // Validation should pass (PATIENT is now in the allowed list)
      expect(response.status).not.toBe(400);
    });

    it('should still accept DOCTOR in expectedRole validation', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'test-doctor-id',
              email: 'doctor@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'DOCTOR',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('SELECT approval_status FROM doctors')) {
          return Promise.resolve({ rows: [{ approval_status: 'ACTIVE' }] });
        }
        if (sql.includes('SELECT two_factor_enabled FROM doctors')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        });

      expect(response.status).not.toBe(400);
    });

    it('should still accept SECRETARY in expectedRole validation', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'test-secretary-id',
              email: 'secretary@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'SECRETARY',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('SELECT two_factor_enabled FROM secretaries')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'secretary@example.com',
          password: 'password123',
          expectedRole: 'SECRETARY'
        });

      expect(response.status).not.toBe(400);
    });

    it('should still accept ADMIN in expectedRole validation', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'test-admin-id',
              email: 'admin@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'ADMIN',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      sendLoginOtp.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123',
          expectedRole: 'ADMIN'
        });

      expect(response.status).not.toBe(400);
    });

    it('should reject invalid expectedRole values', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123',
          expectedRole: 'INVALID_ROLE'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });

    it('should reject missing expectedRole', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });
  });

  describe('Persistent Regression Coverage - Valid Authentication', () => {
    it('should successfully authenticate valid PATIENT credentials and return user data', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'valid-patient-id',
              email: 'patient@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.role).toBe('PATIENT');
      expect(response.body.data.user.email).toBe('patient@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should successfully authenticate valid DOCTOR credentials with active approval', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'valid-doctor-id',
              email: 'doctor@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'DOCTOR',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('SELECT approval_status FROM doctors')) {
          return Promise.resolve({ rows: [{ approval_status: 'ACTIVE' }] });
        }
        if (sql.includes('SELECT two_factor_enabled FROM doctors')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('DOCTOR');
    });

    it('should successfully authenticate valid SECRETARY credentials', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'valid-secretary-id',
              email: 'secretary@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'SECRETARY',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('SELECT two_factor_enabled FROM secretaries')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'secretary@example.com',
          password: 'password123',
          expectedRole: 'SECRETARY'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('SECRETARY');
    });

    it('should return mustChangePassword flag when user has password change requirement', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'patient-id',
              email: 'patient@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: true
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.user.mustChangePassword).toBe(true);
    });
  });

  describe('Persistent Regression Coverage - Invalid Credentials', () => {
    it('should reject login with incorrect password for PATIENT', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'patient-id',
              email: 'patient@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'wrongpassword',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should reject login for inactive user account', async () => {
      // The WHERE clause filters for is_active = true, so inactive accounts return 0 rows
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid credentials');
    });
  });

  describe('Persistent Regression Coverage - Role Mismatch', () => {
    it('should reject PATIENT expectedRole when user is actually DOCTOR', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'doctor-id',
              email: 'doctor@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'DOCTOR',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });

    it('should reject DOCTOR expectedRole when user is actually PATIENT', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'patient-id',
              email: 'patient@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });

    it('should reject SECRETARY expectedRole when user is actually PATIENT', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'patient-id',
              email: 'patient@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'SECRETARY'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });
  });

  describe('Persistent Regression Coverage - DOCTOR Special Requirements', () => {
    it('should reject DOCTOR login with PENDING approval status', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'doctor-id',
              email: 'doctor@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'DOCTOR',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('SELECT approval_status FROM doctors')) {
          return Promise.resolve({ rows: [{ approval_status: 'PENDING' }] });
        }
        if (sql.includes('SELECT two_factor_enabled FROM doctors')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        });

      // The implementation rejects PENDING doctors at the service layer
      // The test verifies this behavior is preserved
      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('awaiting administrator approval');
    });

    it('should allow DOCTOR login with REJECTED approval status (to allow profile correction)', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'doctor-id',
              email: 'doctor@example.com',
              password_hash: '$2a$10$hashedpassword',
              role: 'DOCTOR',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('SELECT approval_status FROM doctors')) {
          return Promise.resolve({ rows: [{ approval_status: 'REJECTED' }] });
        }
        if (sql.includes('SELECT two_factor_enabled FROM doctors')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Persistent Regression Coverage - Request Validation', () => {
    it('should reject login with missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });

    it('should reject login with empty email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: '',
          password: 'password123',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });

    it('should reject login with empty password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'patient@example.com',
          password: '',
          expectedRole: 'PATIENT'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid credentials or account role');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should return new access token after successful password change', async () => {
      let selectCount = 0;
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users WHERE id = $1')) {
          selectCount++;
          // First SELECT: before password change (must_change_password: true)
          if (selectCount === 1) {
            return Promise.resolve({
              rows: [{
                id: 'user-id',
                email: 'user@example.com',
                password_hash: '$2a$10$oldpassword',
                role: 'PATIENT',
                is_active: true,
                must_change_password: true
              }]
            });
          }
          // Second SELECT: after password change (must_change_password: false)
          return Promise.resolve({
            rows: [{
              id: 'user-id',
              email: 'user@example.com',
              password_hash: '$2a$10$newpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: false
            }]
          });
        }
        if (sql.includes('UPDATE users SET password_hash')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('UPDATE trusted_browsers')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('$2a$10$newpassword');

      // Mock JWT verification in authenticate middleware
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: 'user-id',
        email: 'user@example.com',
        role: 'PATIENT',
        mustChangePassword: true
      });

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'oldpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should reject password change with incorrect current password', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [{
              id: 'user-id',
              email: 'user@example.com',
              password_hash: '$2a$10$oldpassword',
              role: 'PATIENT',
              is_active: true,
              must_change_password: true
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'verify').mockReturnValue({
        id: 'user-id',
        email: 'user@example.com',
        role: 'PATIENT',
        mustChangePassword: true
      });

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', 'Bearer test-token')
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });
});
