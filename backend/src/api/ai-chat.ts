import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange } from '../middleware/auth';
import axios from 'axios';
import { config } from '../config';

const router = Router();

// Send message to AI chatbot
router.post('/chat', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Message is required'));
    }

    // Get or create conversation
    let conversationIdToUse = conversationId;

    if (!conversationIdToUse) {
      const patientResult = await query(
        'SELECT id FROM patients WHERE user_id = $1',
        [userId]
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
      }

      const patientId = patientResult.rows[0].id;

      const conversationResult = await query(
        `INSERT INTO ai_conversations (patient_id) VALUES ($1) RETURNING id`,
        [patientId]
      );

      conversationIdToUse = conversationResult.rows[0].id;
    }

    // Get conversation history (last 10 messages for context)
    const historyResult = await query(
      `SELECT role, content FROM ai_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at DESC LIMIT 10`,
      [conversationIdToUse]
    );

    const history = historyResult.rows.reverse();

    // Build messages array for AI
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI medical assistant for FindMyDoctor. Provide general medical information and health education. Never diagnose, never prescribe medication, never claim to be a physician. Always recommend professional or emergency care for urgent cases. Send only the current conversation context - do not request full patient medical records.',
      },
      ...history.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // Call AI API
    try {
      const aiResponse = await axios.post(
        config.ai.apiUrl,
        {
          model: config.ai.model,
          messages,
          max_tokens: 500,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.ai.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const aiMessage = aiResponse.data.choices[0].message.content;

      // Save user message
      await query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'USER', $2)`,
        [conversationIdToUse, message]
      );

      // Save AI response
      await query(
        `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'ASSISTANT', $2)`,
        [conversationIdToUse, aiMessage]
      );

      // Update conversation timestamp
      await query(
        'UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationIdToUse]
      );

      res.json(success({
        message: aiMessage,
        conversationId: conversationIdToUse,
      }));
    } catch (aiError: any) {
      console.error('AI API error:', aiError);
      res.status(500).json(error(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable'));
    }
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to process AI chat'));
  }
});

// Get AI conversations for current user
router.get('/conversations', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT ai_conversations.*,
              (SELECT content FROM ai_messages WHERE conversation_id = ai_conversations.id ORDER BY created_at DESC LIMIT 1) as last_message
       FROM ai_conversations
       WHERE patient_id = (SELECT id FROM patients WHERE user_id = $1)
       ORDER BY updated_at DESC`,
      [userId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch AI conversations'));
  }
});

// Get AI conversation by ID
router.get('/conversations/:id', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const result = await query(
      `SELECT * FROM ai_conversations 
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'AI conversation not found'));
    }

    res.json(success(result.rows[0]));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch AI conversation'));
  }
});

// Get messages for AI conversation
router.get('/conversations/:id/messages', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify access
    const accessResult = await query(
      `SELECT * FROM ai_conversations 
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Access denied'));
    }

    const result = await query(
      'SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch AI messages'));
  }
});

export default router;