/**
 * Tests for the conversations router:
 * - Role-based conversation access (patient own-only + doctor association,
 *   secretary assigned-doctor scope through secretaries.doctor_id)
 * - Conversation reuse (no per-secretary duplicate histories)
 * - Unread counts computed from messages.read_at excluding own messages
 * - Recipient notifications and push delivery after a message is saved
 * - Read-status updates limited to authorized callers
 */

import request from 'supertest';
import express from 'express';

// Current role/user controlled per test
const authState: { role: string; userId: string } = { role: 'PATIENT', userId: 'patient-user-id' };

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  void actual;
  return {
    authenticate: (req: any, _res: any, next: any) => {
      req.user = {
        id: authState.userId,
        email: 'user@example.com',
        role: authState.role,
        mustChangePassword: false,
      };
      next();
    },
    authorize: (...allowedRoles: string[]) => (req: any, res: any, next: any) => {
      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }
      if (!allowedRoles.includes(req.user.role)) {
        return res
          .status(403)
          .json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      }
      next();
    },
    requirePasswordChange: (_req: any, _res: any, next: any) => next(),
    requireSecretaryPasswordChange: (_req: any, _res: any, next: any) => next(),
    requireSecretaryProfileCompletion: (_req: any, _res: any, next: any) => next(),
  };
});

jest.mock('../services/pushService', () => ({
  sendPushToUser: jest.fn(),
}));

import conversationsRouter from './conversations';
import notificationsRouter from './notifications';
import { query } from '../database/connection';
import { sendPushToUser } from '../services/pushService';

const mockedQuery = query as jest.Mock;
const mockedPush = sendPushToUser as jest.Mock;

const CONVERSATION_ROW = {
  id: 'conversation-id',
  patient_id: 'patient-id',
  secretary_id: 'secretary-record-id',
  doctor_id: 'doctor-id',
  status: 'OPEN',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('Conversations Router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/conversations', conversationsRouter);
    app.use('/api/v1/notifications', notificationsRouter);
    authState.role = 'PATIENT';
    authState.userId = 'patient-user-id';
    mockedQuery.mockReset();
    mockedPush.mockReset();
  });

  describe('GET / (conversation list)', () => {
    it('lists patient conversations with unread counts and last-message preview', async () => {
      authState.role = 'PATIENT';
      mockedQuery.mockImplementation(() =>
        Promise.resolve({
          rows: [
            {
              id: 'conversation-id',
              unread_count: 2,
              last_message_preview: 'Hello',
              last_message_sent_at: new Date(),
            },
          ],
        })
      );

      const response = await request(app).get('/api/v1/conversations');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].unread_count).toBe(2);
      expect(response.body.data[0].last_message_preview).toBe('Hello');

      const sql = mockedQuery.mock.calls[0][0];
      // Patient listing is restricted to doctors with an association record
      expect(sql).toContain('patient_doctor_associations');
      // Unread excludes messages sent by the current user
      expect(sql).toContain('sender_user_id <> $2');
      expect(mockedQuery.mock.calls[0][1]).toEqual(['patient-user-id']);
    });

    it('lists secretary conversations scoped to the assigned doctor', async () => {
      authState.role = 'SECRETARY';
      authState.userId = 'secretary-user-id';
      mockedQuery.mockImplementation(() => Promise.resolve({ rows: [] }));

      const response = await request(app).get('/api/v1/conversations');

      expect(response.status).toBe(200);
      const sql = mockedQuery.mock.calls[0][0];
      expect(sql).toContain('secretaries WHERE user_id');
      expect(sql).toContain('doctor_id = (SELECT doctor_id');
      expect(sql).toContain('patient_doctor_associations');
    });

    it('rejects non-patient non-secretary roles', async () => {
      authState.role = 'DOCTOR';
      const response = await request(app).get('/api/v1/conversations');
      expect(response.status).toBe(403);
    });
  });

  describe('POST / (create or retrieve conversation)', () => {
    it('creates a conversation only for an associated patient and assigned secretary', async () => {
      authState.role = 'PATIENT';
      mockedQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT 1 FROM patient_doctor_associations')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }] });
        }
        if (sql.startsWith('SELECT id FROM secretaries WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [{ id: 'secretary-record-id' }] });
        }
        if (sql.startsWith('SELECT id FROM patients WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'patient-id' }] });
        }
        if (sql.includes('SELECT * FROM conversations WHERE patient_id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO conversations')) {
          return Promise.resolve({ rows: [CONVERSATION_ROW] });
        }
        if (sql.includes('secretary_first_name')) {
          return Promise.resolve({ rows: [{ ...CONVERSATION_ROW, secretary_first_name: 'Ann' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/conversations')
        .send({ doctorId: 'doctor-id', secretaryId: 'secretary-record-id' });

      expect(response.status).toBe(201);
      expect(response.body.data.secretary_first_name).toBe('Ann');
      // The secretary must be validated against the specified doctor
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM secretaries WHERE id = $1 AND doctor_id = $2'),
        ['secretary-record-id', 'doctor-id']
      );
    });

    it('rejects patients without an association with the doctor', async () => {
      authState.role = 'PATIENT';
      mockedQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT 1 FROM patient_doctor_associations')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/conversations')
        .send({ doctorId: 'doctor-id' });

      expect(response.status).toBe(403);
    });

    it('rejects a requested secretary not assigned to the doctor', async () => {
      authState.role = 'PATIENT';
      mockedQuery.mockImplementation((sql: string) => {
        if (sql.includes('SELECT 1 FROM patient_doctor_associations')) {
          return Promise.resolve({ rows: [{ association: 1 }] });
        }
        if (sql.startsWith('SELECT id FROM secretaries WHERE id = $1 AND doctor_id = $2')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/conversations')
        .send({ doctorId: 'doctor-id', secretaryId: 'foreign-secretary-id' });

      expect(response.status).toBe(403);
    });

    it('blocks non-patient callers', async () => {
      authState.role = 'SECRETARY';
      const response = await request(app).post('/api/v1/conversations').send({});
      expect(response.status).toBe(403);
    });
  });

  describe('messages', () => {
    it('denies message retrieval for unauthorized conversations', async () => {
      authState.role = 'PATIENT';
      mockedQuery.mockImplementation(() => Promise.resolve({ rows: [] }));

      const response = await request(app).get('/api/v1/conversations/other-id/messages');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CONVERSATION_ACCESS_DENIED');
    });

    it('saves a patient message and notifies only the secretaries (never the sender)', async () => {
      authState.role = 'PATIENT';
      authState.userId = 'patient-user-id';
      const inserted: any[] = [];

      mockedQuery.mockImplementation((sql: string, params: any[] = []) => {
        if (sql.includes('AS secretary_first_name')) {
          return Promise.resolve({ rows: [CONVERSATION_ROW] });
        }
        if (sql.includes('INSERT INTO messages')) {
          inserted.push(params);
          return Promise.resolve({ rows: [{ id: 'message-id', message: 'Hello' }] });
        }
        if (sql.startsWith('UPDATE conversations SET updated_at')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT su.id AS user_id')) {
          expect(sql).toContain('su.id <> $2');
          return Promise.resolve({
            rows: [
              { user_id: 'secretary-a-user-id' },
              { user_id: 'secretary-b-user-id' },
            ],
          });
        }
        if (sql.includes('INSERT INTO notifications')) {
          expect(sql).toContain('conversation');
          inserted.push({ notification: params });
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/conversations/conversation-id/messages')
        .send({ message: 'Hello' });

      expect(response.status).toBe(201);
      const notificationInsert = inserted.find((call) => call.notification) as any;
      expect(notificationInsert).toBeDefined();
      // NEW_PATIENT_MESSAGE for the secretaries, never for the sender
      expect(notificationInsert.notification[1]).toBe('NEW_PATIENT_MESSAGE');
      expect(notificationInsert.notification[0]).not.toBe('patient-user-id');
      // Each recipient (excluding the sender) is notified and pushed
      expect(mockedPush).toHaveBeenCalledTimes(2);
      expect(mockedPush.mock.calls[0][0]).toBe('secretary-a-user-id');
      expect(mockedPush.mock.calls[1][0]).toBe('secretary-b-user-id');
      // Generic push data - never message content
      expect(mockedPush.mock.calls[0][1].body).not.toContain('Hello');
      expect(mockedPush.mock.calls[0][1].data.conversationId).toBe('conversation-id');
    });

    it('saves a secretary message and notifies only the patient', async () => {
      authState.role = 'SECRETARY';
      authState.userId = 'secretary-user-id';

      mockedQuery.mockImplementation((sql: string) => {
        if (sql.includes('patient_first_name')) {
          return Promise.resolve({ rows: [CONVERSATION_ROW] });
        }
        if (sql.includes('INSERT INTO messages')) {
          return Promise.resolve({ rows: [{ id: 'message-id', message: 'Hi' }] });
        }
        if (sql.startsWith('UPDATE conversations SET updated_at')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('SELECT p.user_id')) {
          expect(sql).toContain('p.user_id <> $2');
          return Promise.resolve({ rows: [{ user_id: 'patient-user-id' }] });
        }
        if (sql.includes('INSERT INTO notifications')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/conversations/conversation-id/messages')
        .send({ message: 'Hi' });

      expect(response.status).toBe(201);
      const notificationCall = mockedQuery.mock.calls.find(
        (call) => (call[0] as string).includes('INSERT INTO notifications')
      ) as any[];
      expect(notificationCall).toBeDefined();
      expect(notificationCall[1][0]).toBe('patient-user-id');
      expect(notificationCall[1][1]).toBe('NEW_SECRETARY_MESSAGE');
      expect(mockedPush).toHaveBeenCalledWith(
        'patient-user-id',
        expect.objectContaining({ title: 'New Secretary Message' })
      );
    });

    it('rejects empty messages', async () => {
      authState.role = 'PATIENT';
      const response = await request(app)
        .post('/api/v1/conversations/conversation-id/messages')
        .send({ message: '   ' });
      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /:id/read', () => {
    it('marks only incoming messages as read for an authorized caller', async () => {
      authState.role = 'SECRETARY';
      authState.userId = 'secretary-user-id';

      mockedQuery.mockImplementation((sql: string) => {
        if (sql.includes('patient_first_name')) {
          return Promise.resolve({ rows: [CONVERSATION_ROW] });
        }
        if (sql.includes('UPDATE messages')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app).patch('/api/v1/conversations/conversation-id/read');

      expect(response.status).toBe(200);
      const updateCall = mockedQuery.mock.calls.find(
        (call) => (call[0] as string).includes('UPDATE messages')
      ) as any[];
      expect(updateCall).toBeDefined();
      expect((updateCall[0] as string).includes('sender_user_id != $2')).toBe(true);
      expect((updateCall[0] as string).includes('read_at IS NULL')).toBe(true);
      expect(updateCall[1]).toEqual(['conversation-id', 'secretary-user-id']);
    });

    it('denies read updates for unauthorized conversations', async () => {
      authState.role = 'PATIENT';
      mockedQuery.mockImplementation(() => Promise.resolve({ rows: [] }));

      const response = await request(app).patch('/api/v1/conversations/other-id/read');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CONVERSATION_ACCESS_DENIED');
    });
  });

  describe('device tokens', () => {
    it('registers a device token for the authenticated user', async () => {
      authState.role = 'PATIENT';
      authState.userId = 'patient-user-id';

      mockedQuery.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO device_tokens')) {
          expect(sql).toContain('ON CONFLICT (provider, token)');
          return Promise.resolve({
            rows: [{ id: 'token-id', user_id: 'patient-user-id', provider: 'FCM' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app)
        .post('/api/v1/notifications/device-tokens')
        .send({ token: 'device-token-value', platform: 'ANDROID' });

      expect(response.status).toBe(201);
      expect(response.body.data.user_id).toBe('patient-user-id');
    });

    it('lets users remove only their own tokens', async () => {
      authState.role = 'SECRETARY';
      authState.userId = 'secretary-user-id';

      mockedQuery.mockImplementation((sql: string, params: any[] = []) => {
        if (sql.includes('DELETE FROM device_tokens')) {
          expect(sql).toContain('user_id = $2');
          expect(params).toEqual(['token-id', 'secretary-user-id']);
          return Promise.resolve({ rows: [{ id: 'token-id' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const response = await request(app).delete('/api/v1/notifications/device-tokens/token-id');
      expect(response.status).toBe(200);
    });

    it('returns 404 when another user removes a token they do not own', async () => {
      authState.role = 'SECRETARY';
      authState.userId = 'secretary-user-id';

      mockedQuery.mockImplementation(() => Promise.resolve({ rows: [] }));

      const response = await request(app).delete('/api/v1/notifications/device-tokens/token-id');
      expect(response.status).toBe(404);
    });
  });
});
