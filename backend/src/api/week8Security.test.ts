/**
 * Week 8 security verification.
 *
 * 1. The Flutter mobile app and the Next.js web app must never talk to
 *    PostgreSQL directly and must never carry database or AI-provider
 *    credentials (those stay in the backend environment).
 * 2. The patient ↔ secretary chat boundary must stay closed to doctors and
 *    admins (there is no patient-to-doctor chat).
 */

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import conversationsRouter from './conversations';

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn(),
}));

jest.mock('./notifications', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

let mockUser: any = { id: 'doctor-user-1', role: 'DOCTOR', mustChangePassword: false };

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = mockUser;
    next();
  },
  authorize: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (roles.includes(req.user?.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } });
    }
  },
  requirePasswordChange: (_req: any, _res: any, next: any) => next(),
  requireSecretaryPasswordChange: (_req: any, _res: any, next: any) => next(),
  requireSecretaryProfileCompletion: (_req: any, _res: any, next: any) => next(),
}));

const { query } = require('../database/connection');

const REPO_ROOT = path.resolve(__dirname, '../../..');

function walk(dir: string, extensions: string[], acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, extensions, acc);
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

const FORBIDDEN_CREDENTIAL_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'PostgreSQL connection string', regex: /postgres(?:ql)?:\/\//i },
  { name: 'DATABASE_URL env reference', regex: /\bDATABASE_URL\b/ },
  { name: 'database password env reference', regex: /\b(?:PG|DB|DATABASE)_PASSWORD\b/i },
  { name: 'direct pg driver import', regex: /(?:from\s+['"]pg['"]|require\(\s*['"]pg['"]\s*\))/ },
  { name: 'Dart PostgreSQL package', regex: /package:postgres(?:ql)?\b/ },
  { name: 'AI provider API key env reference', regex: /\b(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE|AI)_API_KEY\b/ },
  { name: 'hard-coded secret-looking token', regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
];

describe('Week 8 security: no direct database or AI credentials in clients', () => {
  const clientRoots = [
    { label: 'Flutter mobile app', dir: path.join(REPO_ROOT, 'mobile', 'lib'), extensions: ['.dart'] },
    { label: 'Next.js web app', dir: path.join(REPO_ROOT, 'web', 'src'), extensions: ['.ts', '.tsx', '.js', '.jsx'] },
  ];

  for (const root of clientRoots) {
    it(`${root.label} contains no database connection strings, drivers, or AI keys`, () => {
      const files = walk(root.dir, root.extensions);
      expect(files.length).toBeGreaterThan(0);

      const violations: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of FORBIDDEN_CREDENTIAL_PATTERNS) {
          if (pattern.regex.test(content)) {
            violations.push(`${path.relative(REPO_ROOT, file)} → ${pattern.name}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  }

  it('the mobile app declares no PostgreSQL / database driver dependency', () => {
    const pubspec = fs.readFileSync(path.join(REPO_ROOT, 'mobile', 'pubspec.yaml'), 'utf8');
    expect(pubspec).not.toMatch(/^\s*postgres(?:ql)?\s*:/im);
    expect(pubspec).not.toMatch(/^\s*postgres_dart\s*:/im);
  });
});

describe('Week 8 security: no patient-to-doctor chat', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/conversations', conversationsRouter);
    jest.clearAllMocks();
  });

  it('denies a doctor access to a conversation thread with 403', async () => {
    mockUser = { id: 'doctor-user-1', role: 'DOCTOR', mustChangePassword: false };

    const response = await request(app).get('/api/v1/conversations/conversation-1/messages');

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('denies a doctor sending a message with 403', async () => {
    mockUser = { id: 'doctor-user-1', role: 'DOCTOR', mustChangePassword: false };

    const response = await request(app)
      .post('/api/v1/conversations/conversation-1/messages')
      .send({ message: 'Hello patient' });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('denies an admin access to a conversation thread with 403', async () => {
    mockUser = { id: 'admin-user-1', role: 'ADMIN', mustChangePassword: false };

    const response = await request(app).get('/api/v1/conversations/conversation-1/messages');

    expect(response.status).toBe(403);
  });

  it('denies an admin the conversation list with 403', async () => {
    mockUser = { id: 'admin-user-1', role: 'ADMIN', mustChangePassword: false };

    const response = await request(app).get('/api/v1/conversations');

    expect(response.status).toBe(403);
  });
});
