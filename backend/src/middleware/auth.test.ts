/**
 * Role resolution and cross-role rejection tests.
 *
 * These cover the shared resource paths (/patients, /prescriptions/patients,
 * /visits/patient) that are used by both the Doctor and Secretary portals.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authenticate, authorize, AuthRequest } from './auth';

function signToken(
  role: string,
  expiresIn: string | number = '1h'
): string {
  return jwt.sign(
    {
      id: `${role.toLowerCase()}-id`,
      email: `${role.toLowerCase()}@example.com`,
      role,
      mustChangePassword: false,
      sv: 0,
    },
    config.jwt.secret,
    { expiresIn } as jwt.SignOptions
  );
}

function cookieHeader(cookies: Array<[string, string]>): string {
  return cookies.map(([name, value]) => `${name}=${value}`).join('; ');
}

function createApp() {
  const app = express();
  app.use(cookieParser());

  const echoUser = (req: AuthRequest, res: express.Response) =>
    res.json({ success: true, role: req.user?.role });

  app.get('/api/v1/doctors/me', authenticate, authorize('DOCTOR'), echoUser);
  app.get('/api/v1/secretaries/me', authenticate, authorize('SECRETARY'), echoUser);
  app.get('/api/v1/admin/ping', authenticate, authorize('ADMIN'), echoUser);

  // Shared resources: the route itself decides which roles are allowed. The
  // authentication middleware must not assume PATIENT from the path.
  app.get('/api/v1/patients/doctor/:id', authenticate, echoUser);
  app.get('/api/v1/prescriptions/patients/:id', authenticate, echoUser);
  app.get('/api/v1/visits/patient/:id', authenticate, echoUser);

  app.get('/api/v1/patients/search', authenticate, authorize('SECRETARY'), echoUser);
  app.get('/api/v1/patients/me', authenticate, authorize('PATIENT'), echoUser);

  // Shared sub-resource under the doctors namespace: used by PATIENT tokens
  // (mobile booking journey) and DOCTOR tokens alike.
  app.get('/api/v1/doctors/:id/availability', authenticate, echoUser);

  return app;
}

describe('authenticate role resolution', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createApp();
  });

  it('accepts a valid doctor token on a doctor path', async () => {
    const response = await request(app)
      .get('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${signToken('DOCTOR')}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('accepts a doctor cookie on /patients/doctor/:id with the doctor portal header', async () => {
    const response = await request(app)
      .get('/api/v1/patients/doctor/doctor-1')
      .set('Cookie', cookieHeader([['doctor_accessToken', signToken('DOCTOR')]]))
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('accepts a doctor cookie on /prescriptions/patients/:id with the doctor portal header', async () => {
    const response = await request(app)
      .get('/api/v1/prescriptions/patients/patient-1')
      .set('Cookie', cookieHeader([['doctor_accessToken', signToken('DOCTOR')]]))
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('accepts a doctor cookie on /visits/patient/:id with the doctor portal header', async () => {
    const response = await request(app)
      .get('/api/v1/visits/patient/patient-1')
      .set('Cookie', cookieHeader([['doctor_accessToken', signToken('DOCTOR')]]))
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('accepts a secretary cookie on a shared patients path with the secretary header', async () => {
    const response = await request(app)
      .get('/api/v1/patients/search')
      .set('Cookie', cookieHeader([['secretary_accessToken', signToken('SECRETARY')]]))
      .set('X-Portal-Role', 'secretary');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('SECRETARY');
  });

  it('accepts a patient cookie on a patient-only path with the patient header', async () => {
    const response = await request(app)
      .get('/api/v1/patients/me')
      .set('Cookie', cookieHeader([['patient_accessToken', signToken('PATIENT')]]))
      .set('X-Portal-Role', 'patient');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('PATIENT');
  });

  it('selects the doctor cookie when both doctor and secretary cookies exist', async () => {
    const response = await request(app)
      .get('/api/v1/patients/doctor/doctor-1')
      .set('Cookie', cookieHeader([
        ['doctor_accessToken', signToken('DOCTOR')],
        ['secretary_accessToken', signToken('SECRETARY')],
      ]))
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('selects the secretary cookie when both portals are signed in', async () => {
    const response = await request(app)
      .get('/api/v1/patients/search')
      .set('Cookie', cookieHeader([
        ['doctor_accessToken', signToken('DOCTOR')],
        ['secretary_accessToken', signToken('SECRETARY')],
      ]))
      .set('X-Portal-Role', 'secretary');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('SECRETARY');
  });

  it('keeps the doctor path authoritative over a spoofed portal header', async () => {
    const response = await request(app)
      .get('/api/v1/doctors/me')
      .set('Cookie', cookieHeader([['doctor_accessToken', signToken('DOCTOR')]]))
      .set('X-Portal-Role', 'patient');

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('rejects a doctor token on a secretary path', async () => {
    const response = await request(app)
      .get('/api/v1/secretaries/me')
      .set('Cookie', cookieHeader([['doctor_accessToken', signToken('DOCTOR')]]))
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(401);
  });

  it('rejects a secretary token on a doctor path', async () => {
    const response = await request(app)
      .get('/api/v1/doctors/me')
      .set('Cookie', cookieHeader([['secretary_accessToken', signToken('SECRETARY')]]))
      .set('X-Portal-Role', 'secretary');

    expect(response.status).toBe(401);
  });

  it('rejects a wrong-role token on a shared path', async () => {
    const response = await request(app)
      .get('/api/v1/patients/doctor/doctor-1')
      .set('Authorization', `Bearer ${signToken('SECRETARY')}`)
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(401);
  });

  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/v1/doctors/me');

    expect(response.status).toBe(401);
  });

  it('rejects a shared patients request with no token', async () => {
    const response = await request(app)
      .get('/api/v1/patients/doctor/doctor-1')
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(401);
  });

  it('rejects an expired doctor token on a shared path', async () => {
    const response = await request(app)
      .get('/api/v1/patients/doctor/doctor-1')
      .set('Cookie', cookieHeader([['doctor_accessToken', signToken('DOCTOR', -1)]]))
      .set('X-Portal-Role', 'doctor');

    expect(response.status).toBe(401);
  });

  it('accepts a patient token on the shared /doctors/:id/availability path', async () => {
    const response = await request(app)
      .get('/api/v1/doctors/doctor-1/availability')
      .set('Authorization', `Bearer ${signToken('PATIENT')}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('PATIENT');
  });

  it('accepts a doctor token on the shared /doctors/:id/availability path', async () => {
    const response = await request(app)
      .get('/api/v1/doctors/doctor-1/availability')
      .set('Authorization', `Bearer ${signToken('DOCTOR')}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DOCTOR');
  });

  it('keeps doctor-only routes protected while availability is shared', async () => {
    const response = await request(app)
      .get('/api/v1/doctors/me')
      .set('Authorization', `Bearer ${signToken('PATIENT')}`);

    expect(response.status).toBe(401);
  });
});
