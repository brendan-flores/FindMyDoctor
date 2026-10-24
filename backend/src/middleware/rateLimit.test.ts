import express from 'express';
import request from 'supertest';
import { createRateLimiter, isSensitiveAuthPath } from './rateLimit';

function makeApp(limiter: express.RequestHandler) {
  const app = express();
  app.use(limiter);
  app.get('/anything', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate limiting middleware', () => {
  it('allows requests up to the configured maximum', async () => {
    const app = makeApp(createRateLimiter({ windowMs: 60_000, max: 2, message: 'slow down' }));

    await request(app).get('/anything').expect(200);
    await request(app).get('/anything').expect(200);
  });

  it('returns 429 with a Retry-After header and the standard error shape', async () => {
    const app = makeApp(createRateLimiter({ windowMs: 60_000, max: 1, message: 'slow down' }));

    await request(app).get('/anything').expect(200);
    const response = await request(app).get('/anything').expect(429);

    expect(response.headers['retry-after']).toBeDefined();
    expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('RATE_LIMIT');
    expect(response.body.error.message).toBe('slow down');
  });

  it('does not count OPTIONS pre-flight requests', async () => {
    const app = makeApp(createRateLimiter({ windowMs: 60_000, max: 1, message: 'slow down' }));

    await request(app).options('/anything').expect(200);
    await request(app).get('/anything').expect(200);
  });
});

describe('auth limiter scoping', () => {
  function makeAuthApp() {
    const app = express();
    // Mirror authLimiter's scoping with a small, deterministic budget so the
    // test does not depend on local environment overrides.
    app.use('/api/v1', createRateLimiter({
      windowMs: 60_000,
      max: 2,
      message: 'slow down',
      skip: (req) => !isSensitiveAuthPath(req),
    }));
    app.get('/api/v1/auth/login', (_req, res) => res.json({ ok: true }));
    app.get('/api/v1/doctors', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('applies the stricter budget only to sensitive auth routes', async () => {
    const app = makeAuthApp();

    await request(app).get('/api/v1/auth/login').expect(200);
    await request(app).get('/api/v1/auth/login').expect(200);
    const blocked = await request(app).get('/api/v1/auth/login').expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body.error.code).toBe('RATE_LIMIT');
  });

  it('does not apply the strict auth budget to regular API routes', async () => {
    const app = makeAuthApp();

    for (let i = 0; i < 10; i += 1) {
      await request(app).get('/api/v1/doctors').expect(200);
    }
  });
});
