/**
 * Tests for GCash QR API - secretary assignment scoping and the QR
 * last-updated timestamp surfaced for the settings page.
 */

import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import gcashQrRouter from './gcashQr';

// Mock dependencies
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

// Supabase storage is not exercised by the GET endpoint
jest.mock('../services/storageService', () => ({
  uploadGcashQr: jest.fn(),
  deleteGcashQr: jest.fn(),
  validateGcashQrFile: jest.fn(),
}));

const { query } = require('../database/connection');

function secretaryUserRow(doctorId: string) {
  return {
    id: 'secretary-user-id',
    email: 'secretary@example.com',
    role: 'SECRETARY',
    is_active: true,
    must_change_password: false,
  };
}

describe('GCash QR API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/v1/gcash-qr', gcashQrRouter);
    jest.clearAllMocks();

    const jwt = require('jsonwebtoken');
    jest.spyOn(jwt, 'verify').mockReturnValue(secretaryUserRow('doctor-1'));
  });

  describe('GET /api/v1/gcash-qr/doctor/:doctorId', () => {
    it('returns the QR URL and its last-updated timestamp for the assigned doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT first_name, last_name, contact_number FROM secretaries')) {
          return Promise.resolve({
            rows: [{ first_name: 'Sara', last_name: 'Santos', contact_number: '09171234567' }],
          });
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'doctor-1' }] });
        }
        if (sql.includes('SELECT gcash_qr_url, gcash_qr_updated_at FROM doctors')) {
          expect(params[0]).toBe('doctor-1');
          return Promise.resolve({
            rows: [{ gcash_qr_url: 'https://storage.example.com/qr.png', gcash_qr_updated_at: '2026-10-20T08:00:00.000Z' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/gcash-qr/doctor/doctor-1')
        .set('Authorization', 'Bearer test-token')
        .set('x-portal-role', 'secretary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.gcashQrUrl).toBe('https://storage.example.com/qr.png');
      expect(response.body.data.gcashQrUpdatedAt).toBe('2026-10-20T08:00:00.000Z');
    });

    it('rejects a secretary assigned to a different doctor', async () => {
      query.mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('SELECT first_name, last_name, contact_number FROM secretaries')) {
          return Promise.resolve({
            rows: [{ first_name: 'Sara', last_name: 'Santos', contact_number: '09171234567' }],
          });
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'doctor-1' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/gcash-qr/doctor/doctor-2')
        .set('Authorization', 'Bearer test-token')
        .set('x-portal-role', 'secretary');

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('assigned doctor');
    });

    it('rejects when no GCash QR exists for an unassigned doctor lookup', async () => {
      query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT first_name, last_name, contact_number FROM secretaries')) {
          return Promise.resolve({
            rows: [{ first_name: 'Sara', last_name: 'Santos', contact_number: '09171234567' }],
          });
        }
        if (sql.includes('SELECT doctor_id FROM secretaries')) {
          return Promise.resolve({ rows: [{ doctor_id: 'doctor-1' }] });
        }
        if (sql.includes('SELECT gcash_qr_url, gcash_qr_updated_at FROM doctors')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .get('/api/v1/gcash-qr/doctor/doctor-1')
        .set('Authorization', 'Bearer test-token')
        .set('x-portal-role', 'secretary');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Doctor not found');
    });
  });
});
