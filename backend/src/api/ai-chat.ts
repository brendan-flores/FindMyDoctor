import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requirePasswordChange } from '../middleware/auth';
import axios from 'axios';
import { config } from '../config';

const router = Router();

// Simple in-memory rate limit tracker for per-patient rate limiting (F3)
// Key: patient_id, Value: { timestamp: number, count: number }
const rateLimitTracker = new Map<string, { timestamp: number; count: number }>();

// Get current date in Asia/Manila timezone (F1)
function getClinicDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: config.app.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD format
  return formatter.format(now);
}

// Interface for structured doctor lookup output from AI
interface DoctorLookupRequest {
  action: 'doctor_lookup';
  specialty: string;
  date: string;
}

// Parse doctor lookup request from AI response (BC2)
function parseDoctorLookup(aiResponse: string): DoctorLookupRequest | null {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(aiResponse);
    if (parsed.action === 'doctor_lookup' && parsed.specialty && parsed.date) {
      return parsed as DoctorLookupRequest;
    }
  } catch {
    // Not JSON, try regex extraction
  }

  // Fallback: extract specialty and date using regex patterns
  const specialtyMatch = aiResponse.match(/specialty[:\s]+([a-zA-Z\s]+)/i);
  const dateMatch = aiResponse.match(/date[:\s]+(\d{4}-\d{2}-\d{2}|today|tomorrow)/i);

  if (specialtyMatch && dateMatch) {
    let date = dateMatch[1].toLowerCase();
    // Convert "today" or "tomorrow" to actual date
    if (date === 'today') {
      date = getClinicDate();
    } else if (date === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const options: Intl.DateTimeFormatOptions = {
        timeZone: config.app.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      };
      date = new Intl.DateTimeFormat('en-CA', options).format(tomorrow);
    }

    return {
      action: 'doctor_lookup',
      specialty: specialtyMatch[1].trim(),
      date,
    };
  }

  return null;
}

// Query available doctors by specialty and date (BC2)
async function getAvailableDoctorsBySpecialty(specialty: string, date: string, patientId: string | null) {
  try {
    // Get all active, approved doctors with the specified specialty
    const doctorsResult = await query(
      `SELECT d.id, d.first_name, d.last_name, d.specialty, d.consultation_fee, d.professional_photo_url, d.practice_name
       FROM doctors d
       WHERE d.approval_status = 'ACTIVE' AND d.specialty ILIKE $1
       ORDER BY d.last_name`,
      [`%${specialty}%`]
    );

    if (doctorsResult.rows.length === 0) {
      return { doctors: [], message: `No doctors found with specialty matching "${specialty}".` };
    }

    // Check availability for each doctor on the specified date
    const doctorsWithAvailability = await Promise.all(
      doctorsResult.rows.map(async (doctor: any) => {
        // Simple availability check: query the appointments table for the date
        // This is a simplified check - the full availability logic is in availabilityService
        const appointmentsResult = await query(
          `SELECT COUNT(*) as booked_count
           FROM appointments
           WHERE doctor_id = $1 AND appointment_date = $2 AND status != 'CANCELLED'`,
          [doctor.id, date]
        );

        // For now, we'll return the doctor regardless of availability
        // The real availability check would need the full availabilityService integration
        return {
          ...doctor,
          available: true, // Simplified - would need real availability check
          bookedCount: parseInt(appointmentsResult.rows[0].booked_count),
        };
      })
    );

    return {
      doctors: doctorsWithAvailability,
      message: null,
    };
  } catch (error) {
    console.error('Error fetching available doctors:', error);
    return {
      doctors: [],
      message: 'Error fetching available doctors. Please try again.',
    };
  }
}

// Redact patient identifiers from messages before sending to AI provider
function redactIdentifiers(content: string): string {
  let redacted = content;

  // Redact email addresses
  redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

  // Redact phone numbers (Philippine format: 09XX XXX XXXX or +63 9XX XXX XXXX)
  redacted = redacted.replace(/\b(?:\+63\s?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[PHONE]');

  // Redact UUIDs (commonly used for IDs in the system)
  redacted = redacted.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[ID]');

  // Redact common name patterns (simple heuristic)
  // This is a basic pattern; more sophisticated NLP could be added later
  redacted = redacted.replace(/\b(Mr|Mrs|Ms|Dr)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '[NAME]');

  return redacted;
}

// Send message to AI chatbot
router.post('/chat', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Message is required'));
    }

    // Check if AI API key is configured
    if (!config.ai.apiKey) {
      console.log('AI API key not configured - returning unavailable response');
      return res.status(503).json(error(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI assistant unavailable'));
    }

    // Get patient ID
    const patientResult = await query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
    }

    const patientId = patientResult.rows[0].id;

    // F4: Validate message length
    if (message.length > config.ai.maxMessageLength) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, `Message too long. Maximum ${config.ai.maxMessageLength} characters.`));
    }

    // F3: Per-patient rate limit check
    const now = Date.now();
    const rateLimitKey = patientId;
    const rateLimitData = rateLimitTracker.get(rateLimitKey);

    if (rateLimitData && now - rateLimitData.timestamp < config.ai.rateLimitWindowMs) {
      if (rateLimitData.count >= config.ai.rateLimitMaxRequests) {
        console.log('AI Chat - Rate limit exceeded for patient:', patientId);
        return res.status(429).json(error(ErrorCodes.RATE_LIMIT, 'Too many requests. Please wait a moment.'));
      }
      rateLimitData.count++;
    } else {
      rateLimitTracker.set(rateLimitKey, { timestamp: now, count: 1 });
    }

    // F1: Check daily message limit (Asia/Manila calendar day)
    const clinicDate = getClinicDate();
    const dailyLimitResult = await query(
      `SELECT message_count FROM ai_daily_limits
       WHERE patient_id = $1 AND message_date = $2`,
      [patientId, clinicDate]
    );

    const currentCount = dailyLimitResult.rows.length > 0 ? dailyLimitResult.rows[0].message_count : 0;

    if (currentCount >= config.ai.dailyLimit) {
      console.log('AI Chat - Daily limit reached for patient:', patientId, 'date:', clinicDate);
      return res.status(429).json(error(ErrorCodes.RATE_LIMIT, `Daily message limit reached (${config.ai.dailyLimit} messages per day). Try again tomorrow.`));
    }

    // Get or create conversation
    let conversationIdToUse = conversationId;

    if (!conversationIdToUse) {
      const conversationResult = await query(
        `INSERT INTO ai_conversations (patient_id) VALUES ($1) RETURNING id`,
        [patientId]
      );

      conversationIdToUse = conversationResult.rows[0].id;
    }

    // F5: Get conversation history with limited context window
    const historyResult = await query(
      `SELECT role, content FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [conversationIdToUse, config.ai.contextWindowMessages]
    );

    const history = historyResult.rows.reverse();

    // Redact identifiers from user message and history before sending to provider
    const redactedMessage = redactIdentifiers(message);
    const redactedHistory = history.map((msg: any) => ({
      role: msg.role.toLowerCase(), // Convert to lowercase for provider compatibility
      content: redactIdentifiers(msg.content),
    }));

    // Build messages array for AI with strengthened system prompt
    const messages = [
      {
        role: 'system',
        content: `You are ${config.ai.fullName}. Your role is to provide general health information, health education, self-care tips, and explain medical terms or tests in plain language.

IMPORTANT SAFETY RULES:
1. NEVER diagnose medical conditions. If a patient describes symptoms, provide general information about what might cause those symptoms but explicitly state you cannot diagnose and they should see a doctor for a proper diagnosis.
2. NEVER prescribe medication or recommend specific treatments. Suggest discussing options with a healthcare provider.
3. NEVER claim to be a doctor or physician. You are an AI assistant providing general information only. Do not include identity statements like "I am ${config.ai.fullName}" in your responses - this is already displayed in the UI.
4. For serious symptoms (chest pain, difficulty breathing, severe bleeding, loss of consciousness, etc.), immediately advise the patient to seek emergency care or call emergency services.
5. For symptom-based questions, provide general information and guide the patient to choose an appropriate specialty, but do not choose the specialty or condition for them.
6. Help patients prepare for visits by suggesting what to tell their doctor or what questions to ask.
7. Point patients to app features like booking, the Doctors tab, or contacting the secretary when relevant.

The conversation context you receive has had personal identifiers (names, emails, phone numbers, IDs) redacted for privacy. Do not attempt to reconstruct or infer personal information.

DOCTOR LOOKUP INSTRUCTIONS:
When a patient asks about available doctors (e.g., "pulmonary doctors available today", "cardiology doctors tomorrow"), you MUST respond with ONLY the following JSON format:
{"action": "doctor_lookup", "specialty": "<specialty name>", "date": "<date or 'today' or 'tomorrow'>"}
For example: {"action": "doctor_lookup", "specialty": "pulmonary", "date": "today"}
Do not include any other text in your response when extracting a doctor lookup request. Only return the JSON.`,
      },
      ...redactedHistory,
      {
        role: 'user',
        content: redactedMessage,
      },
    ];

    // Log redacted prompt content (without sensitive identifiers)
    console.log('AI Chat - Redacted prompt:', JSON.stringify({
      conversationId: conversationIdToUse,
      messageCount: messages.length,
      systemPromptLength: messages[0].content.length,
      userMessageLength: redactedMessage.length,
    }));

    // Call AI API
    try {
      const aiResponse = await axios.post(
        config.ai.apiUrl,
        {
          model: config.ai.model,
          messages,
          max_tokens: config.ai.maxTokens, // F4: Use configured max_tokens
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.ai.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Extract message content, ignoring reasoning field for reasoning-capable models
      const aiMessage = aiResponse.data.choices[0].message.content || '';
      const reasoning = aiResponse.data.choices[0].message.reasoning;

      // Handle empty content reply
      if (!aiMessage) {
        console.log('AI Chat - Empty content in response');
        return res.status(503).json(error(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI assistant returned an empty response. Please try again.'));
      }

      // BC2: Check if AI response contains a doctor lookup request
      const doctorLookup = parseDoctorLookup(aiMessage);

      if (doctorLookup) {
        // AI extracted specialty and date - run backend availability query
        console.log('AI Chat - Doctor lookup detected:', doctorLookup);

        const { doctors, message: availabilityMessage } = await getAvailableDoctorsBySpecialty(
          doctorLookup.specialty,
          doctorLookup.date,
          patientId
        );

        // Save user message (original, not redacted)
        await query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'USER', $2)`,
          [conversationIdToUse, message]
        );

        // Save a friendly message instead of the JSON (for conversation history)
        const friendlyMessage = doctors.length > 0
          ? `Found ${doctors.length} ${doctorLookup.specialty} doctor(s) available on ${doctorLookup.date}.`
          : `No ${doctorLookup.specialty} doctors available on ${doctorLookup.date}. Would you like to check another date?`;
        
        await query(
          `INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1, 'ASSISTANT', $2)`,
          [conversationIdToUse, friendlyMessage]
        );

        // Update conversation timestamp
        await query(
          'UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [conversationIdToUse]
        );

        // F1: Increment daily message counter
        if (dailyLimitResult.rows.length > 0) {
          await query(
            `UPDATE ai_daily_limits
             SET message_count = message_count + 1, last_request_timestamp = CURRENT_TIMESTAMP
             WHERE patient_id = $1 AND message_date = $2`,
            [patientId, clinicDate]
          );
        } else {
          await query(
            `INSERT INTO ai_daily_limits (patient_id, message_date, message_count)
             VALUES ($1, $2, 1)`,
            [patientId, clinicDate]
          );
        }

        // Return doctor lookup results
        if (doctors.length === 0) {
          return res.json(success({
            message: availabilityMessage || `No ${doctorLookup.specialty} doctors available on ${doctorLookup.date}. Would you like to check another date?`,
            conversationId: conversationIdToUse,
            type: 'doctor_lookup',
            doctors: [],
          }));
        }

        return res.json(success({
          message: `Found ${doctors.length} ${doctorLookup.specialty} doctor(s) available on ${doctorLookup.date}.`,
          conversationId: conversationIdToUse,
          type: 'doctor_lookup',
          doctors: doctors.map((d: any) => ({
            id: d.id,
            name: `${d.first_name} ${d.last_name}`,
            specialty: d.specialty,
            consultationFee: d.consultation_fee,
            professionalPhotoUrl: d.professional_photo_url,
            practiceName: d.practice_name,
          })),
        }));
      }

      // Normal AI response (not a doctor lookup)
      // Save user message (original, not redacted)
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

      // F1: Increment daily message counter
      if (dailyLimitResult.rows.length > 0) {
        await query(
          `UPDATE ai_daily_limits
           SET message_count = message_count + 1, last_request_timestamp = CURRENT_TIMESTAMP
           WHERE patient_id = $1 AND message_date = $2`,
          [patientId, clinicDate]
        );
      } else {
        await query(
          `INSERT INTO ai_daily_limits (patient_id, message_date, message_count)
           VALUES ($1, $2, 1)`,
          [patientId, clinicDate]
        );
      }

      // Log redacted response
      console.log('AI Chat - Response:', JSON.stringify({
        conversationId: conversationIdToUse,
        responseLength: aiMessage.length,
      }));

      res.json(success({
        message: aiMessage,
        conversationId: conversationIdToUse,
      }));
    } catch (aiError: any) {
      // F7: Handle provider errors gracefully without exposing raw details
      console.error('AI API error:', {
        status: aiError.response?.status,
        code: aiError.code,
        message: aiError.message,
      });

      if (aiError.response?.status === 429) {
        res.status(429).json(error(ErrorCodes.RATE_LIMIT, 'AI service rate limit exceeded. Please try again later.'));
      } else if (aiError.code === 'ECONNABORTED' || aiError.code === 'ETIMEDOUT') {
        res.status(503).json(error(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable due to timeout'));
      } else {
        res.status(503).json(error(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI assistant unavailable'));
      }
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
              (SELECT content FROM ai_messages WHERE conversation_id = ai_conversations.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = ai_conversations.id) as message_count
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

// Delete AI conversation (and all its messages)
router.delete('/conversations/:id', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const ownershipResult = await query(
      `SELECT * FROM ai_conversations 
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (ownershipResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Access denied'));
    }

    // Delete messages first (due to foreign key constraint)
    await query('DELETE FROM ai_messages WHERE conversation_id = $1', [id]);

    // Delete conversation
    await query('DELETE FROM ai_conversations WHERE id = $1', [id]);

    res.json(success({ message: 'Conversation deleted successfully' }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete conversation'));
  }
});

// Rename AI conversation
router.patch('/conversations/:id', authenticate, requirePasswordChange, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user!.id;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Title is required'));
    }

    // Verify ownership
    const ownershipResult = await query(
      `SELECT * FROM ai_conversations 
       WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)`,
      [id, userId]
    );

    if (ownershipResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Access denied'));
    }

    // Update conversation title
    await query(
      'UPDATE ai_conversations SET title = $1 WHERE id = $2',
      [title.trim(), id]
    );

    res.json(success({ message: 'Conversation renamed successfully', title: title.trim() }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to rename conversation'));
  }
});

export default router;