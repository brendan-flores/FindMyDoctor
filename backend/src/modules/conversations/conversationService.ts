import { query } from '../../database/connection';
import { sendPushToUser } from '../../services/pushService';
import { createNotification } from '../../api/notifications';

/**
 * Conversation authorization and notification helpers for the
 * patient–secretary chat module.
 *
 * Access rules:
 * - A PATIENT may access only their own conversations and only for a doctor
 *   with whom they have a matching `patient_doctor_associations` record.
 * - A SECRETARY is assigned to a single doctor through `secretaries.doctor_id`
 *   and may access conversations only for patients associated with that
 *   doctor. All secretaries assigned to the same doctor share access to the
 *   same conversation and message records (no per-secretary duplicates).
 * - DOCTOR / ADMIN / SUPERADMIN roles never receive conversation access
 *   (patient–doctor chat is prohibited).
 */

export interface AuthorizedConversation {
  id: string;
  patient_id: string;
  secretary_id: string;
  doctor_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

function patientAssociationFilter(alias: string): string {
  return `EXISTS (
    SELECT 1 FROM patient_doctor_associations pda
    WHERE pda.patient_id = ${alias}.patient_id
      AND pda.doctor_id = ${alias}.doctor_id
  )`;
}

/**
 * Return the conversation when the caller is authorized to access it,
 * or null when it does not exist or the caller is not authorized.
 */
export async function getAuthorizedConversation(
  conversationId: string,
  userId: string,
  role: string
): Promise<AuthorizedConversation | null> {
  let queryText: string;
  const params: any[] = [conversationId, userId];

  if (role === 'PATIENT') {
    queryText = `
      SELECT c.*, s.first_name AS secretary_first_name, s.last_name AS secretary_last_name,
             d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, d.practice_name
      FROM conversations c
      JOIN secretaries s ON s.id = c.secretary_id
      JOIN doctors d ON d.id = c.doctor_id
      WHERE c.id = $1
        AND c.patient_id = (SELECT id FROM patients WHERE user_id = $2)
        AND ${patientAssociationFilter('c')}
    `;
  } else if (role === 'SECRETARY') {
    queryText = `
      SELECT c.*, p.first_name AS patient_first_name, p.last_name AS patient_last_name, p.phone AS patient_phone,
             d.first_name AS doctor_first_name, d.last_name AS doctor_last_name, d.practice_name
      FROM conversations c
      JOIN patients p ON p.id = c.patient_id
      JOIN doctors d ON d.id = c.doctor_id
      WHERE c.id = $1
        AND c.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)
        AND ${patientAssociationFilter('c')}
    `;
  } else {
    // Patient-doctor (and any other) chat is prohibited by the architecture
    return null;
  }

  const result = await query(queryText, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

export type MessageSenderRole = 'PATIENT' | 'SECRETARY';

/**
 * Notify the recipient of a saved message. The sender never receives a
 * notification:
 * - Patient-sent message  -> the secretaries assigned to the conversation's
 *   doctor (NEW_PATIENT_MESSAGE).
 * - Secretary-sent message -> the patient (NEW_SECRETARY_MESSAGE).
 *
 * Notification titles, bodies and push payloads are generic and never
 * contain message content.
 */
export async function notifyMessageRecipients(
  senderRole: MessageSenderRole,
  senderUserId: string,
  conversation: AuthorizedConversation
): Promise<void> {
  let notification: { type: string; title: string; message: string };

  if (senderRole === 'PATIENT') {
    notification = {
      type: 'NEW_PATIENT_MESSAGE',
      title: 'New Patient Message',
      message: 'A patient sent you a new message.',
    };
  } else if (senderRole === 'SECRETARY') {
    notification = {
      type: 'NEW_SECRETARY_MESSAGE',
      title: 'New Secretary Message',
      message: 'You have a new message from the clinic.',
    };
  } else {
    return;
  }

  // Resolve recipient user IDs (never the sender)
  let recipientQuery: string;
  let recipientParams: any[];
  if (senderRole === 'PATIENT') {
    recipientQuery = `
      SELECT su.id AS user_id
      FROM secretaries sc
      JOIN users su ON su.id = sc.user_id
      WHERE sc.doctor_id = $1 AND su.id <> $2
    `;
    recipientParams = [conversation.doctor_id, senderUserId];
  } else {
    recipientQuery = `
      SELECT p.user_id
      FROM patients p
      WHERE p.id = $1 AND p.user_id <> $2
    `;
    recipientParams = [conversation.patient_id, senderUserId];
  }

  const recipientsResult = await query(recipientQuery, recipientParams);

  for (const recipient of recipientsResult.rows) {
    if (!recipient.user_id) {
      continue;
    }
    await createNotification(
      recipient.user_id,
      notification.type,
      notification.title,
      notification.message,
      'conversation',
      String(conversation.id)
    );

    // Best-effort push delivery to the recipient's registered devices
    try {
      await sendPushToUser(recipient.user_id, {
        title: notification.title,
        body: notification.message,
        data: {
          type: notification.type,
          conversationId: String(conversation.id),
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed:', pushErr);
    }
  }
}
