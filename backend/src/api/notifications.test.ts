import request from 'supertest';
import express from 'express';

const authState: { userId: string } = { userId: 'user-a' };

jest.mock('../database/connection', () => ({
  query: jest.fn(),
}));

jest.mock('../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: authState.userId,
      email: 'user@example.com',
      role: 'PATIENT',
      mustChangePassword: false,
    };
    next();
  },
}));

import notificationsRouter from './notifications';
import { query } from '../database/connection';

const mockedQuery = query as jest.Mock;

describe('Notifications Router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/notifications', notificationsRouter);
    authState.userId = 'user-a';
    mockedQuery.mockReset();
  });

  it('allows a user to mark their own notification as read', async () => {
    mockedQuery.mockResolvedValue({ rows: [{ id: 'notification-1' }] });

    const response = await request(app)
      .patch('/api/v1/notifications/notification-1/read');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockedQuery).toHaveBeenCalledWith(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      ['notification-1', 'user-a']
    );
  });

  it('returns 404 when another user tries to mark a notification as read', async () => {
    authState.userId = 'user-b';
    mockedQuery.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .patch('/api/v1/notifications/notification-1/read');

    expect(response.status).toBe(404);
    expect(mockedQuery).toHaveBeenCalledWith(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      ['notification-1', 'user-b']
    );
  });

  it('keeps mark-all-as-read scoped to the authenticated user', async () => {
    authState.userId = 'user-a';
    mockedQuery.mockResolvedValue({ rows: [] });

    const response = await request(app)
      .patch('/api/v1/notifications/read-all');

    expect(response.status).toBe(200);
    expect(mockedQuery).toHaveBeenCalledWith(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      ['user-a']
    );
  });
});