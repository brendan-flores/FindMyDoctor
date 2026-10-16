/**
 * Tests for patient required fields migration runner error handling
 * These tests verify that the migration runner correctly handles error conditions
 * The SQL migration has explicit idempotency guards (IF NOT EXISTS), so the runner
 * propagates all errors to surface unexpected failures accurately
 */

import { applyPatientRequiredFields } from './applyPatientRequiredFields';

// Mock the database connection
jest.mock('./connection', () => ({
  query: jest.fn(),
}));

const { query } = require('./connection');

describe('applyPatientRequiredFields Migration Runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should propagate all migration errors including 42P07 (duplicate table)', async () => {
    const error = new Error('relation already exists');
    (error as any).code = '42P07';
    query.mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(applyPatientRequiredFields()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should propagate all migration errors including 42701 (duplicate column)', async () => {
    const error = new Error('column already exists');
    (error as any).code = '42701';
    query.mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(applyPatientRequiredFields()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should propagate 23505 (unique violation) errors', async () => {
    const error = new Error('duplicate key value violates unique constraint');
    (error as any).code = '23505';
    query.mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(applyPatientRequiredFields()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should propagate genuine migration errors', async () => {
    const error = new Error('genuine database error');
    (error as any).code = 'XXXXX';
    query.mockRejectedValue(error);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(applyPatientRequiredFields()).rejects.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should succeed on clean migration', async () => {
    query.mockResolvedValue({ rows: [] });

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    await expect(applyPatientRequiredFields()).resolves.not.toThrow();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('completed successfully')
    );

    consoleLogSpy.mockRestore();
  });
});
