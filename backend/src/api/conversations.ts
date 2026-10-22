import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import {
  getAuthorizedConversation,
  notifyMessageRecipients,
  MessageSenderRole,
  AuthorizedConversation,
} from '../modules/conversations/conversationService';

const router = Router();

// SQL fragment: unread count computed from messages.read_at, excluding
// messages sent by the current user, plus the latest-message preview.
// Handles NULL conversation_id for patients without conversations.
function listExtras(userIdIndex: number): string {
  return `
    CASE WHEN c.id IS NULL THEN 0 ELSE
      (SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id
          AND m.read_at IS NULL
          AND m.sender_user_id <> $${userIdIndex})
    END AS unread_count,
    CASE WHEN c.id IS NULL THEN NULL ELSE
      (SELECT m.message FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.sent_at DESC LIMIT 1)
    END AS last_message_preview,
    CASE WHEN c.id IS NULL THEN NULL ELSE
      (SELECT m.sent_at FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.sent_at DESC LIMIT 1)
    END AS last_message_sent_at,
    CASE WHEN c.id IS NULL THEN NULL ELSE
      (SELECT m.sender_user_id FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.sent_at DESC LIMIT 1)
    END AS last_message_sender_user_id
  `;
}

function patientAssociationFilter(alias: string): string {
  return `EXISTS (
    SELECT 1 FROM patient_doctor_associations pda
    WHERE pda.patient_id = ${alias}.patient_id
      AND pda.doctor_id = ${alias}.doctor_id
  )`;
}

// Get conversations for current user (patient or secretary)
router.get('/', authenticate, requireSecretaryPasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params: any[] = [];

    if (role === 'PATIENT') {
      queryText = `
        SELECT c.id, c.patient_id, c.secretary_id, c.doctor_id, c.status, c.created_at, c.updated_at,
               s.first_name as secretary_first_name, s.last_name as secretary_last_name,
               d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name, d.professional_photo_url as doctor_professional_photo_url,
               ${listExtras(2)}
        FROM conversations c
        JOIN secretaries s ON s.id = c.secretary_id
        JOIN doctors d ON c.doctor_id = d.id
        WHERE c.patient_id = (SELECT id FROM patients WHERE user_id = $1)
          AND ${patientAssociationFilter('c')}
        ORDER BY COALESCE((SELECT m.sent_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1), c.updated_at) DESC
      `;
      params.push(userId, userId);
    } else if (role === 'SECRETARY') {
      // For secretaries: show all patients with appointments OR existing conversations
      // Patients without conversations will have NULL conversation fields
      queryText = `
        SELECT DISTINCT ON (p.id)
               c.id, p.id as patient_id, c.secretary_id, c.doctor_id, c.status, c.created_at, c.updated_at,
               p.first_name as patient_first_name, p.last_name as patient_last_name,
               d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name, d.professional_photo_url as doctor_professional_photo_url,
               ${listExtras(2)}
        FROM patients p
        JOIN doctors d ON d.id = (SELECT doctor_id FROM secretaries WHERE user_id = $1)
        LEFT JOIN conversations c ON c.patient_id = p.id AND c.doctor_id = d.id
        WHERE EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.patient_id = p.id AND a.doctor_id = d.id
        )
        ORDER BY p.id, COALESCE(c.updated_at, (SELECT MAX(a.appointment_date) FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = d.id)) DESC
      `;
      params.push(userId, userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role for conversations'));
    }

    const result = await query(queryText, params);

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch conversations'));
  }
});

// Create (or retrieve) the patient's conversation with an assigned secretary for a doctor
router.post('/', authenticate, requireSecretaryPasswordChange, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { doctorId, secretaryId, patientId } = req.body;

    if (role === 'PATIENT') {
      if (!doctorId) {
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Doctor ID is required'));
      }

      // The patient must have a matching patient_doctor_associations record
      const associationResult = await query(
        `SELECT 1 FROM patient_doctor_associations
         WHERE patient_id = (SELECT id FROM patients WHERE user_id = $1)
           AND doctor_id = $2`,
        [userId, doctorId]
      );

      if (associationResult.rows.length === 0) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You are not associated with this doctor'));
      }

      let assignedSecretaryId: string;

      if (secretaryId) {
        // When a specific secretary is requested, verify they are assigned to the doctor
        const secretaryResult = await query(
          `SELECT id FROM secretaries WHERE id = $1 AND doctor_id = $2`,
          [secretaryId, doctorId]
        );

        if (secretaryResult.rows.length === 0) {
          return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Secretary is not assigned to this doctor'));
        }
        assignedSecretaryId = secretaryResult.rows[0].id;
      } else {
        // Otherwise reuse the assigned secretary for the doctor
        const secretaryResult = await query(
          `SELECT id FROM secretaries WHERE doctor_id = $1 ORDER BY created_at ASC LIMIT 1`,
          [doctorId]
        );

        if (secretaryResult.rows.length === 0) {
          return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'No secretary is assigned to this doctor'));
        }
        assignedSecretaryId = secretaryResult.rows[0].id;
      }

      const patientResult = await query(
        'SELECT id FROM patients WHERE user_id = $1',
        [userId]
      );

      if (patientResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient profile not found'));
      }
      const patientId = patientResult.rows[0].id;

      // Reuse the existing conversation record for this patient + doctor so
      // secretaries of the same doctor keep a shared message history.
      const existingResult = await query(
        `SELECT * FROM conversations WHERE patient_id = $1 AND doctor_id = $2 LIMIT 1`,
        [patientId, doctorId]
      );

      if (existingResult.rows.length > 0) {
        const enriched = await query(
          `SELECT c.id, c.patient_id, c.secretary_id, c.doctor_id, c.status, c.created_at, c.updated_at,
                  s.first_name as secretary_first_name, s.last_name as secretary_last_name,
                  d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name
           FROM conversations c
           JOIN secretaries s ON s.id = c.secretary_id
           JOIN doctors d ON c.doctor_id = d.id
           WHERE c.id = $1`,
          [existingResult.rows[0].id]
        );
        return res.json(success(enriched.rows[0], 'Conversation already exists'));
      }

      // Create new conversation
      const result = await query(
        `INSERT INTO conversations (patient_id, secretary_id, doctor_id, status)
         VALUES ($1, $2, $3, 'OPEN')
         RETURNING *`,
        [patientId, assignedSecretaryId, doctorId]
      );

      const enriched = await query(
        `SELECT c.id, c.patient_id, c.secretary_id, c.doctor_id, c.status, c.created_at, c.updated_at,
                s.first_name as secretary_first_name, s.last_name as secretary_last_name,
                d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name
         FROM conversations c
         JOIN secretaries s ON s.id = c.secretary_id
         JOIN doctors d ON c.doctor_id = d.id
         WHERE c.id = $1`,
        [result.rows[0].id]
      );

      res.status(201).json(success(enriched.rows[0], 'Conversation created'));
    } else if (role === 'SECRETARY') {
      // Secretary can create a conversation for a specific patient
      if (!patientId) {
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Patient ID is required'));
      }

      // Get the secretary's assigned doctor
      const secretaryResult = await query(
        'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
        [userId]
      );

      if (secretaryResult.rows.length === 0) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Secretary not found'));
      }

      const doctorId = secretaryResult.rows[0].doctor_id;
      const secretaryId = secretaryResult.rows[0].id;

      // Verify the patient has an appointment with this doctor
      const appointmentResult = await query(
        `SELECT 1 FROM appointments
         WHERE patient_id = $1 AND doctor_id = $2
         LIMIT 1`,
        [patientId, doctorId]
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Patient has no appointment with this doctor'));
      }

      // Ensure patient_doctor_associations record exists (required for patient to see conversation)
      const associationResult = await query(
        `SELECT 1 FROM patient_doctor_associations
         WHERE patient_id = $1 AND doctor_id = $2
         LIMIT 1`,
        [patientId, doctorId]
      );

      if (associationResult.rows.length === 0) {
        // Create the association record so the patient can access the conversation
        await query(
          `INSERT INTO patient_doctor_associations (patient_id, doctor_id, details_completion_status)
           VALUES ($1, $2, 'PENDING')`,
          [patientId, doctorId]
        );
      }

      // Reuse the existing conversation record for this patient + doctor
      const existingResult = await query(
        `SELECT * FROM conversations WHERE patient_id = $1 AND doctor_id = $2 LIMIT 1`,
        [patientId, doctorId]
      );

      if (existingResult.rows.length > 0) {
        const enriched = await query(
          `SELECT c.id, c.patient_id, c.secretary_id, c.doctor_id, c.status, c.created_at, c.updated_at,
                  p.first_name as patient_first_name, p.last_name as patient_last_name,
                  d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name
           FROM conversations c
           JOIN patients p ON c.patient_id = p.id
           JOIN doctors d ON c.doctor_id = d.id
           WHERE c.id = $1`,
          [existingResult.rows[0].id]
        );
        return res.json(success(enriched.rows[0], 'Conversation already exists'));
      }

      // Create new conversation
      const result = await query(
        `INSERT INTO conversations (patient_id, secretary_id, doctor_id, status)
         VALUES ($1, $2, $3, 'OPEN')
         RETURNING *`,
        [patientId, secretaryId, doctorId]
      );

      const enriched = await query(
        `SELECT c.id, c.patient_id, c.secretary_id, c.doctor_id, c.status, c.created_at, c.updated_at,
                p.first_name as patient_first_name, p.last_name as patient_last_name,
                d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name
         FROM conversations c
         JOIN patients p ON c.patient_id = p.id
         JOIN doctors d ON c.doctor_id = d.id
         WHERE c.id = $1`,
        [result.rows[0].id]
      );

      res.status(201).json(success(enriched.rows[0], 'Conversation created'));
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role for creating conversations'));
    }
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create conversation'));
  }
});

// Get conversation by ID (authorized callers only)
router.get('/:id', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    const conversation = await getAuthorizedConversation(id, userId, role);

    if (!conversation) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Conversation not found'));
    }

    res.json(success(conversation));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch conversation'));
  }
});

// Get messages for conversation (authorized callers only)
router.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Verify access
    const conversation = await getAuthorizedConversation(id, userId, role);

    if (!conversation) {
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

// Send message (authorized callers only)
router.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user!.id;
    const role = req.user!.role;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Message is required'));
    }

    // Verify user is authorized to send message
    const conversation = await getAuthorizedConversation(id, userId, role);

    if (!conversation) {
      return res.status(403).json(error(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Not authorized to send messages'));
    }

    // Send message
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_user_id, message)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, message.trim()]
    );

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // Notify the recipient (never the sender) with a generic notification
    const senderRole = (role === 'PATIENT' ? 'PATIENT' : 'SECRETARY') as MessageSenderRole;
    await notifyMessageRecipients(senderRole, userId, conversation as AuthorizedConversation);

    res.status(201).json(success(result.rows[0], 'Message sent'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to send message'));
  }
});

// Mark incoming messages as read (authorized callers only)
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Verify access
    const conversation = await getAuthorizedConversation(id, userId, role);

    if (!conversation) {
      return res.status(403).json(error(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Access denied to this conversation'));
    }

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

// Get appointment summary by patient ID (for patients without conversations)
router.get('/patient/:patientId/appointment-summary', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role !== 'SECRETARY') {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Only secretaries can view the appointment summary'));
    }

    // Get the secretary's assigned doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Secretary not found'));
    }

    const doctorId = secretaryResult.rows[0].doctor_id;

    // Verify the patient has an appointment with this doctor
    const appointmentCheck = await query(
      `SELECT 1 FROM appointments
       WHERE patient_id = $1 AND doctor_id = $2
       LIMIT 1`,
      [patientId, doctorId]
    );

    if (appointmentCheck.rows.length === 0) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Patient has no appointment with this doctor'));
    }

    // Read-only: only the appointment fields the patient-info sheet needs
    const summaryResult = await query(
      `SELECT
         p.id as patient_id,
         p.first_name as patient_first_name,
         p.middle_name as patient_middle_name,
         p.last_name as patient_last_name,
         p.date_of_birth as patient_date_of_birth,
         p.phone as patient_phone,
         u.email as patient_email,
         a.id as appointment_id,
         a.appointment_date,
         a.status as appointment_status,
         a.reason_for_visit,
         (SELECT q.queue_number FROM queue_entries q WHERE q.appointment_id = a.id LIMIT 1) as queue_number,
         d.first_name as doctor_first_name,
         d.last_name as doctor_last_name,
         d.practice_name
       FROM patients p
       JOIN users u ON u.id = p.user_id
       JOIN doctors d ON d.id = $2
       LEFT JOIN appointments a ON a.patient_id = p.id AND a.doctor_id = d.id
      WHERE p.id = $1
      ORDER BY
        (ARRAY_POSITION(ARRAY['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'], a.status) IS NOT NULL) DESC NULLS LAST,
        a.appointment_date DESC NULLS LAST
      LIMIT 1`,
      [patientId, doctorId]
    );

    const row = summaryResult.rows[0];

    const summary = {
      patient: {
        id: row.patient_id,
        firstName: row.patient_first_name,
        middleName: row.patient_middle_name || null,
        lastName: row.patient_last_name,
        dateOfBirth: row.patient_date_of_birth || null,
        phone: row.patient_phone || null,
        email: row.patient_email || null,
      },
      appointment: row.appointment_id
        ? {
            appointmentDate: row.appointment_date,
            status: row.appointment_status,
            reasonForVisit: row.reason_for_visit || null,
            queueNumber: row.queue_number ?? null,
          }
        : null,
      doctor: {
        firstName: row.doctor_first_name,
        lastName: row.doctor_last_name,
        practiceName: row.practice_name,
      },
    };

    res.json(success(summary));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch appointment summary'));
  }
});

// Read-only appointment summary for the secretary chat patient-info sheet
router.get('/:id/appointment-summary', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    if (role !== 'SECRETARY') {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Only secretaries can view the appointment summary'));
    }

    // Check if id is a valid UUID (conversation) or a patient ID
    // If it's "null" or invalid, return 404
    if (!id || id === 'null' || id === 'undefined') {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Invalid conversation ID'));
    }

    const conversation = await getAuthorizedConversation(id, userId, role);

    if (!conversation) {
      return res.status(403).json(error(ErrorCodes.CONVERSATION_ACCESS_DENIED, 'Access denied to this conversation'));
    }

    // Read-only: only the appointment fields the patient-info sheet needs
    const summaryResult = await query(
      `SELECT
         p.id as patient_id,
         p.first_name as patient_first_name,
         p.middle_name as patient_middle_name,
         p.last_name as patient_last_name,
         p.date_of_birth as patient_date_of_birth,
         p.phone as patient_phone,
         u.email as patient_email,
         a.id as appointment_id,
         a.appointment_date,
         a.status as appointment_status,
         a.reason_for_visit,
         (SELECT q.queue_number FROM queue_entries q WHERE q.appointment_id = a.id LIMIT 1) as queue_number,
         d.first_name as doctor_first_name,
         d.last_name as doctor_last_name,
         d.practice_name
       FROM conversations c
       JOIN patients p ON p.id = c.patient_id
       JOIN users u ON u.id = p.user_id
       JOIN doctors d ON d.id = c.doctor_id
       LEFT JOIN appointments a ON a.patient_id = c.patient_id AND a.doctor_id = c.doctor_id
      WHERE c.id = $1
      ORDER BY
        (ARRAY_POSITION(ARRAY['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'], a.status) IS NOT NULL) DESC NULLS LAST,
        a.appointment_date DESC NULLS LAST
      LIMIT 1`,
      [id]
    );

    const row = summaryResult.rows[0];

    const summary = {
      patient: {
        id: row.patient_id,
        firstName: row.patient_first_name,
        middleName: row.patient_middle_name || null,
        lastName: row.patient_last_name,
        dateOfBirth: row.patient_date_of_birth || null,
        phone: row.patient_phone || null,
        email: row.patient_email || null,
      },
      appointment: row.appointment_id
        ? {
            appointmentDate: row.appointment_date,
            status: row.appointment_status,
            reasonForVisit: row.reason_for_visit || null,
            queueNumber: row.queue_number ?? null,
          }
        : null,
      doctor: {
        firstName: row.doctor_first_name,
        lastName: row.doctor_last_name,
        practiceName: row.practice_name,
      },
    };

    res.json(success(summary));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch appointment summary'));
  }
});

export default router;
