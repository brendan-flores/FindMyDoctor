/**
 * Tests for the terminal-only SuperAdmin seed script.
 * Verifies that the seeder creates exactly one SUPERADMIN account through the
 * same bcrypt hashing used by the auth flow, rejects duplicates, validates
 * input before touching the database, and never returns the password.
 */

import { createSuperAdminAccount } from './seedSuperAdmin';
import { ErrorCodes } from '../utils/response';

jest.mock('./connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const { query } = require('./connection');
const bcrypt = require('bcryptjs');

const VALID_EMAIL = 'root@findmydoctor.local';
const VALID_PASSWORD = 'Sup3r$ecret!';

function mockNoExistingUsers() {
  query.mockImplementation((sql: string) => {
    if (sql.includes("role = 'SUPERADMIN'")) {
      return Promise.resolve({ rows: [] });
    }
    if (sql.includes('INSERT INTO users')) {
      return Promise.resolve({
        rows: [{ id: 'superadmin-id', email: VALID_EMAIL, role: 'SUPERADMIN' }],
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('seedSuperAdmin - createSuperAdminAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.hash.mockResolvedValue('$2a$10$mockedhash');
    mockNoExistingUsers();
  });

  it('creates a SUPERADMIN account with a bcrypt-hashed password', async () => {
    const result = await createSuperAdminAccount({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(bcrypt.hash).toHaveBeenCalledWith(VALID_PASSWORD, 10);

    const insertCall = query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO users')
    );
    expect(insertCall).toBeDefined();

    const [insertSql, params] = insertCall;
    expect(insertSql).toContain("'SUPERADMIN'");
    expect(params[0]).toBe(VALID_EMAIL);
    expect(params[1]).toBe('$2a$10$mockedhash');
    expect(params[1]).not.toBe(VALID_PASSWORD);
    expect(params[2]).toBe('root');

    expect(result).toEqual({
      id: 'superadmin-id',
      email: VALID_EMAIL,
      role: 'SUPERADMIN',
    });
  });

  it('normalizes the email to lowercase before storing', async () => {
    await createSuperAdminAccount({
      email: '  Root@FindMyDoctor.LOCAL ',
      password: VALID_PASSWORD,
    });

    const emailCheck = query.mock.calls.find(([sql, params]: [string, any[]]) =>
      sql.includes('WHERE email = $1')
    );
    expect(emailCheck[1][0]).toBe(VALID_EMAIL);

    const insertCall = query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO users')
    );
    expect(insertCall[1][0]).toBe(VALID_EMAIL);
  });

  it('rejects seeding when a SUPERADMIN already exists and never inserts', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("role = 'SUPERADMIN'")) {
        return Promise.resolve({
          rows: [{ id: 'existing-id', email: 'existing@findmydoctor.local' }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      createSuperAdminAccount({ email: VALID_EMAIL, password: VALID_PASSWORD })
    ).rejects.toMatchObject({ code: ErrorCodes.CONFLICT });

    const insertCall = query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO users')
    );
    expect(insertCall).toBeUndefined();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('rejects an email that is already registered', async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("role = 'SUPERADMIN'")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('WHERE email = $1')) {
        return Promise.resolve({ rows: [{ id: 'other-user-id' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      createSuperAdminAccount({ email: VALID_EMAIL, password: VALID_PASSWORD })
    ).rejects.toMatchObject({ code: ErrorCodes.EMAIL_ALREADY_EXISTS });

    const insertCall = query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO users')
    );
    expect(insertCall).toBeUndefined();
  });

  it.each([
    ['not-an-email', VALID_PASSWORD],
    ['', VALID_PASSWORD],
    [VALID_EMAIL, 'short1!'],
    [VALID_EMAIL, 'nouppercase1!'],
    [VALID_EMAIL, 'NOLOWERCASE1!'],
    [VALID_EMAIL, 'NoDigits!@#'],
    [VALID_EMAIL, 'NoSpecial123'],
    [VALID_EMAIL, ''],
  ])('rejects invalid input %j before touching the database', async (email, password) => {
    await expect(
      createSuperAdminAccount({ email, password })
    ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR });

    expect(query).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('does not expose the password in the returned result', async () => {
    const result = await createSuperAdminAccount({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    expect(result).not.toHaveProperty('password');
    expect(JSON.stringify(result)).not.toContain(VALID_PASSWORD);
  });

  it('always assigns the SUPERADMIN role and cannot create other roles', async () => {
    await createSuperAdminAccount({
      email: VALID_EMAIL,
      password: VALID_PASSWORD,
    });

    const insertCall = query.mock.calls.find(([sql]: [string]) =>
      sql.includes('INSERT INTO users')
    );
    const [insertSql, params] = insertCall;

    // The role is hardcoded in the INSERT; no caller-supplied role parameter exists.
    expect(insertSql).toContain("'SUPERADMIN'");
    expect(insertSql).not.toContain("'ADMIN'");
    expect(params.some((p: any) => typeof p === 'string' && p === 'ADMIN')).toBe(false);
  });
});
