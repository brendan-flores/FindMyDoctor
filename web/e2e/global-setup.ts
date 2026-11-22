import { request } from '@playwright/test';

/**
 * Playwright E2E preflight.
 *
 * The Next.js frontend bakes NEXT_PUBLIC_API_URL into the running dev/build at
 * startup. Start `npm run dev` or `npm run build && npm run start` with the
 * same NEXT_PUBLIC_API_URL value used here; a Playwright environment variable
 * cannot retroactively change an already-running Next.js server.
 */

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export default async function globalSetup() {
  const required = [
    'E2E_BASE_URL',
    'E2E_API_URL',
    'E2E_BACKEND_URL',
    'NEXT_PUBLIC_API_URL',
    'E2E_DATABASE_NAME',
    'E2E_SUPERADMIN_EMAIL',
    'E2E_SUPERADMIN_PASSWORD',
    'E2E_DOCTOR_EMAIL',
    'E2E_DOCTOR_PASSWORD',
    'E2E_SECRETARY_EMAIL',
    'E2E_SECRETARY_PASSWORD',
    'E2E_PATIENT_ID',
    'E2E_APPOINTMENT_ID',
  ];
  for (const name of required) {
    if (!process.env[name]) {
      throw new Error(`Missing required E2E environment variable: ${name}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('E2E tests cannot run in production mode');
  }

  const dbName = process.env.E2E_DATABASE_NAME || '';
  if (!/e2e/i.test(dbName)) {
    throw new Error(`E2E_DATABASE_NAME must identify a dedicated E2E database: ${dbName}`);
  }

  const apiURL = normalizeUrl(process.env.E2E_API_URL || '');
  const backendURL = normalizeUrl(process.env.E2E_BACKEND_URL || '');
  const nextPublicApiURL = normalizeUrl(process.env.NEXT_PUBLIC_API_URL || '');
  const baseURL = normalizeUrl(process.env.E2E_BASE_URL || '');

  let parsedApi: URL;
  let parsedBackend: URL;
  let parsedBase: URL;
  let parsedNextPublic: URL;
  try {
    parsedApi = new URL(apiURL);
    parsedBackend = new URL(backendURL);
    parsedBase = new URL(baseURL);
    parsedNextPublic = new URL(nextPublicApiURL);
  } catch {
    throw new Error('E2E_BASE_URL, E2E_API_URL, E2E_BACKEND_URL, and NEXT_PUBLIC_API_URL must be valid URLs');
  }

  if (!/^https?:$/.test(parsedApi.protocol) || !/^https?:$/.test(parsedBackend.protocol) || !/^https?:$/.test(parsedBase.protocol) || !/^https?:$/.test(parsedNextPublic.protocol)) {
    throw new Error('E2E_BASE_URL, E2E_API_URL, E2E_BACKEND_URL, and NEXT_PUBLIC_API_URL must be valid URLs');
  }

  if (parsedApi.protocol !== parsedBackend.protocol || parsedApi.hostname !== parsedBackend.hostname || parsedApi.port !== parsedBackend.port) {
    throw new Error('E2E_API_URL must use the same protocol, hostname, and port as E2E_BACKEND_URL');
  }

  if (parsedApi.pathname !== '/api/v1') {
    throw new Error('E2E_API_URL must use the expected /api/v1 API path');
  }

  if (parsedNextPublic.href.replace(/\/$/, '') !== parsedApi.href.replace(/\/$/, '')) {
    throw new Error(`NEXT_PUBLIC_API_URL must exactly match E2E_API_URL: expected ${apiURL}, got ${nextPublicApiURL}`);
  }

  if (!['localhost', '127.0.0.1', '::1'].includes(parsedBase.hostname)) {
    throw new Error('E2E_BASE_URL must use a loopback host for local E2E');
  }

  const context = await request.newContext();
  const health = await context.get(`${backendURL}/health`);
  if (!health.ok()) {
    throw new Error(`Backend health check failed: ${health.status()}`);
  }

  const dbResponse = await context.get(`${backendURL}/health/e2e-db`);
  if (!dbResponse.ok()) {
    throw new Error('Backend E2E database verification endpoint is unavailable; ensure E2E_TEST_MODE=true and NODE_ENV is not production');
  }
  const dbBody = await dbResponse.json();
  if (dbBody.database !== dbName) {
    throw new Error(`Backend database mismatch: expected ${dbName}, got ${dbBody.database}`);
  }
  await context.dispose();
}