import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get conversations for current user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params: any[] = [];

    if (role === 'PATIENT') {
      queryText = `
        SELECT c.*, 
               s.first_name as secretary_first_name, s.last_name as secretary_last_name,
               cl.name as clinic_name,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.read_at IS NULL) as unread_count
        FROM conversations c
        JOIN secretaries s ON c.secretary_id = s.id
        JOIN clinics cl ON c.clinic_id = cl.id
        WHERE c.patient_id = (SELECT id FROM patients WHERE user_id = $1)
        ORDER BY c.updated_at DESC
      `;
      params.push(userId);
    } else if (role === 'SECRETARY') {
      queryText = `
        SELECT c.*, 
               p.first_name as patient_first_name, p.last_name as patient_last_name,
               cl.name as clinic_name,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.read_at IS NULL AND m.sender_user_id != $1) as unread_count
        FROM conversations c
        JOIN patients p ON c.patient_id = p.id
        JOIN clinics cl ON c.clinic_id = cl.id
        WHERE c.secretary_id = (SELECT id FROM secretaries WHERE user_id = $1)
        ORDER BY c.updated_at DESC
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role for conversations'));
    }

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch conversations'));
  }
});

// Create conversation
router.post('/', authenticate, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { secretaryId, clinicId } = req.body;

    if (!secretaryId || !clinicId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Secretary ID and clinic ID are required'));
    }

    // Check if conversation already exists
    const existingResult = await query(
      `SELECT * FROM conversations 
       WHERE patient_id = (SELECT id FROM patients WHERE user_id = $1) 
       AND secretary_id = $2 AND clinic_id = $3`,
      [userId, secretaryId, clinicId]
    );

    if (existingResult.rows.length > 0) {
      return res.json(success(existingResult.rows[0], 'Conversation already exists'));
    }

    // Create new conversation
    const result = await query(
      `INSERT INTO conversations (patient_id, secretary_id, clinic_id, status)
       VALUES ((SELECT id FROM patients WHERE user_id = $1), $2, $3, 'OPEN')
       RETURNING *`,
      [userId, secretaryId, clinicId]
    );

    res.status(201).json(success(result.rows[0], 'Conversation created'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create conversation'));
  }
});

// Get conversation by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      queryText = `
        SELECT c.* FROM conversations c
        WHERE c.id = $1 AND c.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'SECRETARY') {
      queryText = `
        SELECT c.* FROM conversations c
        WHERE c.id = $1 AND c.secretary_id = (SELECT id FROM secretaries WHERE user_id = $2)
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Conversation not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch conversation'));
  }
});

// Get messages for conversation
router.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Verify access
    let accessQuery = '';
    const accessParams = [id, userId];

    if (role === 'PATIENT') {
      accessQuery = 'SELECT * FROM conversations WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)';
    } else if (role === 'SECRETARY') {
      accessQuery = 'SELECT * FROM conversations WHERE id = $1 AND secretary_id = (SELECT id FROM secretaries WHERE user_id = $2)';
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const accessResult = await query(accessQuery, accessParams);

    if (accessResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Access denied to this conversation'));
    }

    // Get messages
    const messagesResult = await query(
      `SELECT m.*, u.email as sender_email
       FROM messages m
       JOIN users u ON m.sender_user_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.sent_at ASC`,
      [id]
    );

    res.json(success(messagesResult.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch messages'));
  }
});

// Send message
router.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;

    if (!message) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Message is required'));
    }

    // Verify access
    const accessResult = await query(
      `SELECT * FROM conversations WHERE id = $1`,
      [id]
    );

    if (accessResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Conversation not found'));
    }

    const conversation = accessResult.rows[0];

    // Verify user is authorized to send message
    const userIdResult = await query(
      'SELECT id FROM patients WHERE user_id = $1 UNION SELECT id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (userIdResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid user'));
    }

    const userEntityId = userIdResult.rows[0].id;

    if (conversation.patient_id !== userEntityId && conversation.secretary_id !== userEntityId) {
      return res.status(403).json(error(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Not authorized to send messages'));
    }

    // Send message
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, message]
    );

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.status(201).json(success(result.rows[0], 'Message sent'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to send message'));
  }
});

// Mark conversation as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Mark all messages from other users as read
    await query(
      `UPDATE messages 
       SET read_at = CURRENT_TIMESTAMP 
       WHERE conversation_id = $1 AND sender_user_id != $2 AND read_at IS NULL`,
      [id, userId]
    );

    res.json(success(null, 'Messages marked as read'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to mark messages as read'));
  }
});

export default router;