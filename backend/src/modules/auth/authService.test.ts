/**
 * Tests for authService - authentication service layer
 * These tests verify service-level authentication behavior including
 * role validation, password verification, and mustChangePassword handling
 */

import { login, changePassword } from './authService';
import { ErrorCodes } from '../../utils/response';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// Mock JWT module
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
    id: 'user-id',
    email: 'user@example.com',
    role: 'PATIENT',
    mustChangePassword: false
  }),
}));

// Mock dependencies
jest.mock('../../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mocked-jwt-token'),
}));

const { query } = require('../../database/connection');
const bcrypt = require('bcryptjs');

describe('AuthService - Login Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Valid Authentication', () => {
    it('should successfully authenticate PATIENT with valid credentials', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 'patient-id',
          email: 'patient@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'PATIENT',
          is_active: true,
          must_change_password: false
        }]
      });

      bcrypt.compare.mockResolvedValue(true);

      const result = await login({
        email: 'patient@example.com',
        password: 'password123',
        expectedRole: 'PATIENT'
      });

      expect(result.user.role).toBe('PATIENT');
      expect(result.user.email).toBe('patient@example.com');
      expect(result.user.mustChangePassword).toBe(false);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should successfully authenticate DOCTOR with active approval status', async () => {
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
          return Promise.resolve({ rows: [{ approval_status: 'ACTIVE' }] });
        }
        if (sql.includes('SELECT two_factor_enabled FROM doctors')) {
          return Promise.resolve({ rows: [{ two_factor_enabled: false }] });
        }
        return Promise.resolve({ rows: [] });
      });

      bcrypt.compare.mockResolvedValue(true);

      const result = await login({
        email: 'doctor@example.com',
        password: 'password123',
        expectedRole: 'DOCTOR'
      });

      expect(result.user.role).toBe('DOCTOR');
      expect(result.accessToken).toBeDefined();
    });

    it('should successfully authenticate SECRETARY', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT * FROM users')) {
          return Promise.resolve({
            rows: [{
              id: 'secretary-id',
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

      bcrypt.compare.mockResolvedValue(true);

      const result = await login({
        email: 'secretary@example.com',
        password: 'password123',
        expectedRole: 'SECRETARY'
      });

      expect(result.user.role).toBe('SECRETARY');
      expect(result.accessToken).toBeDefined();
    });

    it('should return mustChangePassword flag when user has password change requirement', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 'patient-id',
          email: 'patient@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'PATIENT',
          is_active: true,
          must_change_password: true
        }]
      });

      bcrypt.compare.mockResolvedValue(true);

      const result = await login({
        email: 'patient@example.com',
        password: 'password123',
        expectedRole: 'PATIENT'
      });

      expect(result.user.mustChangePassword).toBe(true);
    });
  });

  describe('Invalid Credentials', () => {
    it('should reject login with incorrect password', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 'patient-id',
          email: 'patient@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'PATIENT',
          is_active: true,
          must_change_password: false
        }]
      });

      bcrypt.compare.mockResolvedValue(false);

      await expect(
        login({
          email: 'patient@example.com',
          password: 'wrongpassword',
          expectedRole: 'PATIENT'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid credentials'
      });
    });

    it('should reject login with non-existent email', async () => {
      query.mockResolvedValue({ rows: [] });

      await expect(
        login({
          email: 'nonexistent@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid credentials'
      });
    });

    it('should reject login for inactive user account', async () => {
      // The WHERE clause filters for is_active = true, so inactive accounts return 0 rows
      query.mockResolvedValue({ rows: [] });

      await expect(
        login({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid credentials'
      });
    });
  });

  describe('Role Mismatch', () => {
    it('should reject PATIENT expectedRole when user is actually DOCTOR', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 'doctor-id',
          email: 'doctor@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'DOCTOR',
          is_active: true,
          must_change_password: false
        }]
      });

      bcrypt.compare.mockResolvedValue(true);

      await expect(
        login({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'PATIENT'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid credentials or account role.'
      });
    });

    it('should reject DOCTOR expectedRole when user is actually PATIENT', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 'patient-id',
          email: 'patient@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'PATIENT',
          is_active: true,
          must_change_password: false
        }]
      });

      bcrypt.compare.mockResolvedValue(true);

      await expect(
        login({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid credentials or account role.'
      });
    });

    it('should reject SECRETARY expectedRole when user is actually PATIENT', async () => {
      query.mockResolvedValue({
        rows: [{
          id: 'patient-id',
          email: 'patient@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'PATIENT',
          is_active: true,
          must_change_password: false
        }]
      });

      bcrypt.compare.mockResolvedValue(true);

      await expect(
        login({
          email: 'patient@example.com',
          password: 'password123',
          expectedRole: 'SECRETARY'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
        message: 'Invalid credentials or account role.'
      });
    });
  });

  describe('DOCTOR Special Requirements', () => {
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
        return Promise.resolve({ rows: [] });
      });

      bcrypt.compare.mockResolvedValue(true);

      await expect(
        login({
          email: 'doctor@example.com',
          password: 'password123',
          expectedRole: 'DOCTOR'
        })
      ).rejects.toMatchObject({
        code: ErrorCodes.DOCTOR_PENDING_APPROVAL,
        message: 'Your account is awaiting administrator approval'
      });
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

      bcrypt.compare.mockResolvedValue(true);

      const result = await login({
        email: 'doctor@example.com',
        password: 'password123',
        expectedRole: 'DOCTOR'
      });

      expect(result.user.role).toBe('DOCTOR');
      expect(result.accessToken).toBeDefined();
    });
  });
});

describe('AuthService - Change Password Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully change password with valid current password', async () => {
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

    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('$2a$10$newpassword');

    const result = await changePassword('user-id', 'oldpassword', 'newpassword123');

    expect(result.success).toBe(true);
    expect(result.accessToken).toBeDefined();
    expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', '$2a$10$oldpassword');
    expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
  });

  it('should reject password change with incorrect current password', async () => {
    query.mockResolvedValue({
      rows: [{
        id: 'user-id',
        email: 'user@example.com',
        password_hash: '$2a$10$oldpassword',
        role: 'PATIENT',
        is_active: true,
        must_change_password: true
      }]
    });

    bcrypt.compare.mockResolvedValue(false);

    await expect(
      changePassword('user-id', 'wrongpassword', 'newpassword123')
    ).rejects.toMatchObject({
      code: ErrorCodes.INVALID_CREDENTIALS,
      message: 'Current password is incorrect'
    });
  });

  it('should reject password change for non-existent user', async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(
      changePassword('nonexistent-id', 'oldpassword', 'newpassword123')
    ).rejects.toMatchObject({
      code: ErrorCodes.NOT_FOUND,
      message: 'User not found'
    });
  });

  it('should revoke all trusted browsers on password change', async () => {
    let selectCount = 0;
    query.mockImplementation((sql: string, params: any[]) => {
      if (sql.includes('SELECT * FROM users WHERE id = $1')) {
        selectCount++;
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
      if (sql.includes('UPDATE users SET password_hash')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('UPDATE trusted_browsers')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('$2a$10$newpassword');

    await changePassword('user-id', 'oldpassword', 'newpassword123');

    // Verify that revoke query was called
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE trusted_browsers'),
      expect.any(Array)
    );
  });

  it('should return new access token with mustChangePassword false after successful password change', async () => {
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

    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue('$2a$10$newpassword');

    const result = await changePassword('user-id', 'oldpassword', 'newpassword123');

    expect(result.success).toBe(true);
    expect(result.accessToken).toBeDefined();

    // Verify jwt.sign was called with mustChangePassword: false
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        mustChangePassword: false
      }),
      config.jwt.secret,
      expect.any(Object)
    );
  });

  it('should allow password change without current password when mustChangePassword is true (walk-in first login)', async () => {
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
              password_hash: '$2a$10$temppassword',
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

    bcrypt.hash.mockResolvedValue('$2a$10$newpassword');

    // Call changePassword with undefined currentPassword and mustChangePassword = true
    const result = await changePassword('user-id', undefined, 'newpassword123', true);

    expect(result.success).toBe(true);
    expect(result.accessToken).toBeDefined();

    // Verify bcrypt.compare was NOT called (current password verification skipped)
    expect(bcrypt.compare).not.toHaveBeenCalled();

    // Verify password was still hashed and updated
    expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);

    // Verify jwt.sign was called with mustChangePassword: false
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        mustChangePassword: false
      }),
      config.jwt.secret,
      expect.any(Object)
    );
  });

  it('should require current password when mustChangePassword is false', async () => {
    query.mockResolvedValue({
      rows: [{
        id: 'user-id',
        email: 'user@example.com',
        password_hash: '$2a$10$oldpassword',
        role: 'PATIENT',
        is_active: true,
        must_change_password: false
      }]
    });

    // Call changePassword with undefined currentPassword and mustChangePassword = false
    await expect(
      changePassword('user-id', undefined, 'newpassword123', false)
    ).rejects.toMatchObject({
      code: ErrorCodes.VALIDATION_ERROR,
      message: 'Current password is required'
    });
  });
});
