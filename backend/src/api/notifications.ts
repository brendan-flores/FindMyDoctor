import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate } from '../middleware/auth';

const router = Router();

const VALID_PROVIDERS = ['FCM', 'APNS'];
const VALID_PLATFORMS = ['IOS', 'ANDROID', 'WEB'];

// Notification type constants
export const NotificationTypes = {
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  NEW_SECRETARY_MESSAGE: 'NEW_SECRETARY_MESSAGE',
  NEW_PATIENT_MESSAGE: 'NEW_PATIENT_MESSAGE',
  PRESCRIPTION_AVAILABLE: 'PRESCRIPTION_AVAILABLE',
} as const;

/**
 * Helper function to create a notification for a user.
 * Inserts into the notifications table with the provided details.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  relatedEntityType: string,
  relatedEntityId: string
): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, type, title, message, relatedEntityType, relatedEntityId]
  );
}

// Get notifications for current user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch notifications'));
  }
});

// Get unread notification count for current user
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    const count = parseInt(result.rows[0].count, 10);
    res.json(success({ count }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch unread count'));
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [id]
    );

    res.json(success(null, 'Notification marked as read'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to mark notification as read'));
  }
});

// Register a push device token for the authenticated user
router.post('/device-tokens', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token, provider, platform, deviceInfo } = req.body;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Device token is required'));
    }

    if (token.length > 4096) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Device token is too long'));
    }

    const tokenProvider = typeof provider === 'string' && VALID_PROVIDERS.includes(provider) ? provider : 'FCM';
    const tokenPlatform = typeof platform === 'string' && VALID_PLATFORMS.includes(platform) ? platform : 'ANDROID';
    const tokenDeviceInfo = typeof deviceInfo === 'string' ? deviceInfo.slice(0, 255) : null;

    // Associate the token with its owning user; re-registering a token
    // reassigns it to the latest registered owner (one active owner per token).
    const result = await query(
      `INSERT INTO device_tokens (user_id, token, provider, platform, device_info)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (provider, token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             device_info = EXCLUDED.device_info,
             updated_at = CURRENT_TIMESTAMP
       RETURNING id, user_id, provider, platform, device_info, created_at, updated_at`,
      [userId, token.trim(), tokenProvider, tokenPlatform, tokenDeviceInfo]
    );

    res.status(201).json(success(result.rows[0], 'Device token registered'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to register device token'));
  }
});

// Remove one of the authenticated user's registered device tokens
router.delete('/device-tokens/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Users can remove only their own tokens
    const result = await query(
      'DELETE FROM device_tokens WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Device token not found'));
    }

    res.json(success(null, 'Device token removed'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to remove device token'));
  }
});

export default router;
