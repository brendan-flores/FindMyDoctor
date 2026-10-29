import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import { sendPushToUser } from '../services/pushService';
import multer from 'multer';
import { uploadPaymentReceipt, validatePaymentReceiptFile, generateSignedReceiptUrl } from '../services/storageService';
import { createNotification, NotificationTypes } from './notifications';

const router = Router();

// Configure multer for receipt upload (memory storage for Supabase)
const storage = multer.memoryStorage();

// File filter - accept PNG and JPEG for receipts
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG and JPEG files are allowed for receipts'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// Get GCash QR code (public endpoint, no authentication required)
// This route must be registered before the authenticate middleware in index.ts
export const publicPaymentsRouter = Router();
publicPaymentsRouter.get('/gcash-qr', async (req: AuthRequest, res: Response) => {
  try {
    const { doctorId } = req.query;

    if (!doctorId) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'doctorId is required'));
    }

    // Get the doctor's GCash QR URL from database
    const doctorResult = await query(
      'SELECT gcash_qr_url FROM doctors WHERE id = $1',
      [doctorId]
    );

    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor not found'));
    }

    const gcashQrUrl = doctorResult.rows[0].gcash_qr_url;

    if (!gcashQrUrl) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'GCash QR code not configured for this doctor'));
    }

    res.json(success({ qrUrl: gcashQrUrl }, 'GCash QR code URL retrieved'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to retrieve GCash QR code'));
  }
});

// List payments for secretary (secretary only)
router.get('/', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status } = req.query;

    // Get secretary's assigned doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Validate status filter if provided
    if (status && !['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED', 'CANCELLED'].includes(status as string)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid status filter. Valid values: UNPAID, PENDING_VERIFICATION, PAID, REJECTED, CANCELLED'));
    }

    // Build query with optional status filter
    let queryText = `
      SELECT
        p.id,
        p.appointment_id,
        p.status,
        p.payment_method,
        p.receipt_url,
        p.consultation_amount,
        p.total_additional_charges,
        p.total_amount,
        p.amount_paid,
        p.created_at,
        p.verified_by,
        p.verified_at,
        pat.first_name as patient_first_name,
        pat.last_name as patient_last_name,
        pat.phone as patient_phone,
        s.first_name as verified_by_first_name,
        s.last_name as verified_by_last_name,
        a.appointment_date,
        a.reason_for_visit
      FROM payments p
      JOIN patients pat ON p.patient_id = pat.id
      JOIN appointments a ON p.appointment_id = a.id
      LEFT JOIN secretaries s ON p.verified_by = s.id
      WHERE a.doctor_id = $1
    `;
    const params: any[] = [assignedDoctorId];

    if (status) {
      queryText += ' AND p.status = $2';
      params.push(status);
    }

    queryText += ' ORDER BY p.created_at DESC';

    const result = await query(queryText, params);

    // Fetch charges for all returned payments in one query instead of one
    // query per payment (the previous N+1 behaviour).
    const chargesByPayment = new Map<string, any[]>();
    const paymentIds = result.rows.map(payment => payment.id);

    if (paymentIds.length > 0) {
      const chargesResult = await query(
        `SELECT
          pc.id,
          pc.payment_id,
          pc.charge_type,
          pc.description,
          pc.amount,
          pc.quantity,
          pc.unit_price,
          pc.prescription_item_id,
          pc.created_at,
          pc.created_by,
          s.first_name as created_by_first_name,
          s.last_name as created_by_last_name
         FROM payment_charges pc
         LEFT JOIN secretaries s ON pc.created_by = s.id
         WHERE pc.payment_id = ANY($1::uuid[]) AND pc.deleted_at IS NULL`,
        [paymentIds]
      );

      for (const charge of chargesResult.rows) {
        const list = chargesByPayment.get(charge.payment_id) || [];
        list.push(charge);
        chargesByPayment.set(charge.payment_id, list);
      }
    }

    const payments = result.rows.map(payment => {
      const balance = Math.max(0, parseFloat(payment.total_amount) - parseFloat(payment.amount_paid));
      return {
        ...payment,
        charges: chargesByPayment.get(payment.id) || [],
        balance: balance.toFixed(2),
      };
    });

    res.json(success(payments));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payments'));
  }
});

// Get payment counts by status (secretary only)
router.get('/counts', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get secretary's assigned doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get counts for all statuses in a single query
    const result = await query(
      `SELECT
        p.status,
        COUNT(*) as count
      FROM payments p
      JOIN appointments a ON p.appointment_id = a.id
      WHERE a.doctor_id = $1
      GROUP BY p.status`,
      [assignedDoctorId]
    );

    // Initialize counts with 0 for all statuses
    const counts = {
      UNPAID: 0,
      PENDING_VERIFICATION: 0,
      PAID: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };

    // Update counts from query result
    for (const row of result.rows) {
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = parseInt(row.count);
      }
    }

    res.json(success(counts));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payment counts'));
  }
});

// Get payment for appointment
router.get('/:appointmentId', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [appointmentId];

    if (role === 'PATIENT') {
      queryText = `
        SELECT p.*, s.first_name as verified_by_first_name, s.last_name as verified_by_last_name
        FROM payments p
        LEFT JOIN secretaries s ON p.verified_by = s.id
        WHERE p.appointment_id = $1 AND p.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'SECRETARY') {
      // Secretary must be assigned to the payment's doctor
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [userId]
      );

      if (secretaryResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
      }

      const assignedDoctorId = secretaryResult.rows[0].doctor_id;

      queryText = `
        SELECT p.*,
               pat.first_name as patient_first_name, pat.last_name as patient_last_name,
               s.first_name as verified_by_first_name, s.last_name as verified_by_last_name
        FROM payments p
        JOIN patients pat ON p.patient_id = pat.id
        JOIN appointments a ON p.appointment_id = a.id
        LEFT JOIN secretaries s ON p.verified_by = s.id
        WHERE p.appointment_id = $1
          AND a.doctor_id = $2
      `;
      params.push(assignedDoctorId);
    } else if (role === 'ADMIN') {
      queryText = `
        SELECT p.*, 
               pat.first_name as patient_first_name, pat.last_name as patient_last_name,
               s.first_name as verified_by_first_name, s.last_name as verified_by_last_name
        FROM payments p
        JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN secretaries s ON p.verified_by = s.id
        WHERE p.appointment_id = $1
      `;
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    // Get additional charges (excluding deleted charges)
    const chargesResult = await query(
      `SELECT
        pc.id,
        pc.charge_type,
        pc.description,
        pc.amount,
        pc.quantity,
        pc.unit_price,
        pc.prescription_item_id,
        pc.created_at,
        pc.created_by,
        s.first_name as created_by_first_name,
        s.last_name as created_by_last_name
       FROM payment_charges pc
       LEFT JOIN secretaries s ON pc.created_by = s.id
       WHERE pc.payment_id = $1 AND pc.deleted_at IS NULL`,
      [result.rows[0].id]
    );

    const payment = result.rows[0];
    payment.charges = chargesResult.rows;
    const balance = Math.max(0, parseFloat(payment.total_amount) - parseFloat(payment.amount_paid));
    payment.balance = balance.toFixed(2);

    res.json(success(payment));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payment'));
  }
});

// Upload GCash receipt
router.post('/:appointmentId/receipt', authenticate, authorize('PATIENT'), upload.single('receipt'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { appointmentId } = req.params;

    if (!req.file) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'No file uploaded'));
    }

    // Validate image file type and size
    const validation = validatePaymentReceiptFile(req.file.buffer, req.file.mimetype);
    if (!validation.valid) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, validation.error));
    }

    // Generate unique filename: receipt_<appointment_id>_<timestamp>_<random>.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `receipt_${appointmentId}_${uniqueSuffix}.${fileExtension}`;

    // Upload to Supabase Storage
    const uploadResult = await uploadPaymentReceipt(req.file.buffer, fileName, req.file.mimetype);

    if (!uploadResult.success) {
      client.release();
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, uploadResult.error || 'Failed to upload receipt'));
    }

    const receiptPath = uploadResult.path!;

    await client.query('BEGIN');

    // Check if payment exists
    const existingResult = await client.query(
      'SELECT * FROM payments WHERE appointment_id = $1',
      [appointmentId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing payment (add receipt URL, don't change status if already PENDING_VERIFICATION)
      await client.query(
        `UPDATE payments
         SET receipt_url = $1, payment_method = 'GCASH', updated_at = CURRENT_TIMESTAMP
         WHERE appointment_id = $2`,
        [receiptPath, appointmentId]
      );
    } else {
      // Create new payment record
      const appointmentResult = await client.query(
        'SELECT * FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (appointmentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
      }

      const appointment = appointmentResult.rows[0];

      // Get consultation fee
      const doctorResult = await client.query(
        'SELECT consultation_fee FROM doctors WHERE id = $1',
        [appointment.doctor_id]
      );

      const consultationFee = doctorResult.rows[0].consultation_fee;

      await client.query(
        `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_amount, status, receipt_url)
         VALUES ($1, $2, 'GCASH', $3, $3, 'PENDING_VERIFICATION', $4)`,
        [appointment.patient_id, appointmentId, consultationFee, receiptPath]
      );
    }

    await client.query('COMMIT');
    client.release();

    res.json(success({ receiptPath }, 'Receipt uploaded successfully'));
  } catch (err: any) {
    console.error('Receipt upload error:', err.message || err);
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to upload receipt'));
  }
});

// Verify payment (secretary only)
router.patch('/:id/verify', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

    await client.query('BEGIN');

    // Get secretary's assigned doctor and secretary id
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id, pat.user_id as patient_user_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only verify payments for your assigned doctor'));
    }

    if (payment.status === 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.PAYMENT_ALREADY_VERIFIED, 'Payment already verified'));
    }

    if (payment.status !== 'PENDING_VERIFICATION') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.PAYMENT_VERIFICATION_REQUIRED, 'Payment is not in pending verification status'));
    }

    // Update payment verification metadata only (do not change status to PAID or set amount_paid)
    // Secretary must explicitly use /mark-paid to mark a verified GCash payment as PAID
    await client.query(
      `UPDATE payments
       SET verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [secretaryRecordId, id]
    );

    // Insert notification for patient using helper
    await createNotification(
      payment.patient_user_id,
      NotificationTypes.PAYMENT_VERIFIED,
      'Payment Receipt Verified',
      'Your payment receipt has been verified.',
      'payment',
      id
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Payment Receipt Verified',
        body: 'Your payment receipt has been verified.',
        data: {
          type: 'PAYMENT_VERIFIED',
          paymentId: id,
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed:', pushErr);
    }

    res.json(success(null, 'Payment receipt verified successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to verify payment'));
  }
});

// Reject payment (secretary only)
router.patch('/:id/reject', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

    await client.query('BEGIN');

    // Get secretary's assigned doctor and secretary id
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id, pat.user_id as patient_user_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only reject payments for your assigned doctor'));
    }

    if (payment.status !== 'PENDING_VERIFICATION') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.PAYMENT_VERIFICATION_REQUIRED, 'Payment is not in pending verification status'));
    }

    // Update payment status
    await client.query(
      `UPDATE payments
       SET status = 'REJECTED', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [secretaryRecordId, id]
    );

    // Insert notification for patient using helper
    await createNotification(
      payment.patient_user_id,
      NotificationTypes.PAYMENT_REJECTED,
      'Payment Rejected',
      'Your payment was rejected. Please contact the clinic.',
      'payment',
      id
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Payment Rejected',
        body: 'Your payment was rejected. Please contact the clinic.',
        data: {
          type: 'PAYMENT_REJECTED',
          paymentId: id,
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed:', pushErr);
    }

    res.json(success(null, 'Payment rejected'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reject payment'));
  }
});

// Mark as paid (for cash payments, secretary only)
router.patch('/:id/mark-paid', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

    await client.query('BEGIN');

    // Get secretary's assigned doctor and secretary id
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id, pat.user_id as patient_user_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only mark payments as paid for your assigned doctor'));
    }

    if (payment.status === 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.PAYMENT_ALREADY_VERIFIED, 'Payment already paid'));
    }

    // Allow marking UNPAID (cash) or PENDING_VERIFICATION (verified GCash) as PAID
    if (payment.status !== 'UNPAID' && payment.status !== 'PENDING_VERIFICATION') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Only unpaid or verified payments can be marked as paid'));
    }

    // Update payment status and set amount_paid to total_amount
    await client.query(
      `UPDATE payments
       SET status = 'PAID', amount_paid = $1, verified_by = $2, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [payment.total_amount, secretaryRecordId, id]
    );

    // Update queue entry status to COMPLETED
    await client.query(
      `UPDATE queue_entries
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE appointment_id = $1`,
      [payment.appointment_id]
    );

    // Insert notification for patient
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'PAYMENT_VERIFIED', 'Payment Confirmed', 'Your payment has been confirmed.', 'payment', $2)`,
      [payment.patient_user_id, id]
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Payment Confirmed',
        body: 'Your payment has been confirmed.',
        data: {
          type: 'PAYMENT_VERIFIED',
          paymentId: id,
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed:', pushErr);
    }

    res.json(success(null, 'Payment marked as paid'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to mark payment as paid'));
  }
});

// Add additional charge (secretary only)
router.post('/:id/charges', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { chargeType, description, amount, name, quantity, unitPrice, prescriptionItemId } = req.body;
    const userId = req.user!.id;

    // Determine charge type (default to ADDITIONAL for backward compatibility)
    const finalChargeType = chargeType || 'ADDITIONAL';

    // Validate charge type
    if (!['ADDITIONAL', 'MEDICINE'].includes(finalChargeType)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid charge type. Must be ADDITIONAL or MEDICINE'));
    }

    let chargeAmount: number;
    let chargeDescription: string;

    if (finalChargeType === 'MEDICINE') {
      // Medicine charge validation
      if (!name || typeof name !== 'string' || name.trim() === '') {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Medicine name is required for medicine charges'));
      }

      const numericQuantity = Number(quantity);
      if (isNaN(numericQuantity) || !isFinite(numericQuantity) || numericQuantity <= 0) {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Quantity must be a valid positive number'));
      }

      const numericUnitPrice = Number(unitPrice);
      if (isNaN(numericUnitPrice) || !isFinite(numericUnitPrice) || numericUnitPrice <= 0) {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Unit price must be a valid positive number'));
      }

      // Calculate amount on server (never trust client-supplied medicine total)
      chargeAmount = numericQuantity * numericUnitPrice;
      chargeDescription = name.trim();

      // Round to 2 decimal places for monetary precision
      chargeAmount = Math.round(chargeAmount * 100) / 100;
    } else {
      // Additional charge validation (backward compatible)
      if (!description || typeof description !== 'string' || description.trim() === '') {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Description is required and must be valid'));
      }

      if (amount === undefined || amount === null) {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Amount is required'));
      }

      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || !isFinite(numericAmount)) {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Amount must be a valid number'));
      }

      if (numericAmount <= 0) {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Amount must be greater than zero'));
      }

      chargeAmount = numericAmount;
      chargeDescription = description.trim();
    }

    await client.query('BEGIN');

    // Get secretary record and assigned doctor
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id, a.id as appointment_id, pat.user_id as patient_user_id, pat.id as patient_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only add charges to payments for your assigned doctor'));
    }

    // Only allow charge addition for UNPAID and PENDING_VERIFICATION payments
    if (payment.status === 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot add charges to a paid payment'));
    }

    if (payment.status === 'REJECTED') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot add charges to a rejected payment'));
    }

    // Validate prescription item if provided (medicine charges only)
    if (finalChargeType === 'MEDICINE' && prescriptionItemId) {
      const prescriptionItemResult = await client.query(
        `SELECT pi.*, p.prescription_id, p.patient_id, p.doctor_id, v.appointment_id
         FROM prescription_items pi
         JOIN prescriptions p ON pi.prescription_id = p.id
         JOIN visits v ON p.visit_id = v.id
         WHERE pi.id = $1`,
        [prescriptionItemId]
      );

      if (prescriptionItemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription item not found'));
      }

      const prescriptionItem = prescriptionItemResult.rows[0];

      // Verify prescription item belongs to the same patient as the payment
      if (prescriptionItem.patient_id !== payment.patient_id) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Prescription item does not belong to the payment patient'));
      }

      // Verify prescription item belongs to the same appointment/visit as the payment
      if (prescriptionItem.appointment_id !== payment.appointment_id) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Prescription item does not belong to the payment appointment'));
      }

      // Verify prescription item belongs to the same doctor as the payment
      if (prescriptionItem.doctor_id !== payment.doctor_id) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Prescription item does not belong to the payment doctor'));
      }
    }

    // Insert charge with appropriate fields based on type
    if (finalChargeType === 'MEDICINE') {
      await client.query(
        `INSERT INTO payment_charges (payment_id, charge_type, description, amount, quantity, unit_price, prescription_item_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, 'MEDICINE', chargeDescription, chargeAmount, Number(quantity), Number(unitPrice), prescriptionItemId || null, secretaryRecordId]
      );
    } else {
      await client.query(
        `INSERT INTO payment_charges (payment_id, charge_type, description, amount, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, 'ADDITIONAL', chargeDescription, chargeAmount, secretaryRecordId]
      );
    }

    // Recalculate total from authoritative charge records (excluding deleted charges)
    const chargesResult = await client.query(
      'SELECT COALESCE(SUM(amount)::numeric, 0) as total_charges FROM payment_charges WHERE payment_id = $1 AND deleted_at IS NULL',
      [id]
    );

    const totalCharges = parseFloat(chargesResult.rows[0].total_charges);
    const newTotal = parseFloat(payment.consultation_amount) + totalCharges;

    console.log('[Add Charge] Current consultation_amount:', payment.consultation_amount);
    console.log('[Add Charge] Total charges from DB:', totalCharges);
    console.log('[Add Charge] New total:', newTotal);
    console.log('[Add Charge] Payment ID:', id);

    // Update payment totals (do not reset amount_paid or change status)
    const updateResult = await client.query(
      `UPDATE payments
       SET total_additional_charges = $1, total_amount = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [totalCharges, newTotal, id]
    );

    console.log('[Add Charge] Update result rowCount:', updateResult.rowCount);

    // Insert notification for patient with charge amount
    const notificationMessage = `An additional charge of ₱${chargeAmount.toFixed(2)} has been added to your payment.`;
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'ADDITIONAL_CHARGE_ADDED', 'Additional Charge Added', $2, 'payment', $3)`,
      [payment.patient_user_id, notificationMessage, id]
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Additional Charge Added',
        body: notificationMessage,
        data: {
          type: 'ADDITIONAL_CHARGE_ADDED',
          paymentId: id,
          amount: chargeAmount.toString(),
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed:', pushErr);
    }

    res.json(success(null, 'Additional charge added'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to add charge'));
  }
});

// Delete additional charge (secretary only)
router.delete('/:id/charges/:chargeId', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id, chargeId } = req.params;
    const userId = req.user!.id;

    await client.query('BEGIN');

    // Get secretary record and assigned doctor
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only delete charges from payments for your assigned doctor'));
    }

    // Only allow charge deletion for UNPAID and PENDING_VERIFICATION payments
    if (payment.status === 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot delete charges from a paid payment'));
    }

    if (payment.status === 'REJECTED') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot delete charges from a rejected payment'));
    }

    // Verify charge belongs to the specified payment and is not already deleted
    const chargeResult = await client.query(
      'SELECT * FROM payment_charges WHERE id = $1 AND payment_id = $2 AND deleted_at IS NULL',
      [chargeId, id]
    );

    if (chargeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Charge not found or already deleted'));
    }

    // Soft-delete the charge by setting deleted_at
    await client.query(
      'UPDATE payment_charges SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [chargeId]
    );

    // Recalculate total from authoritative charge records (excluding deleted charges)
    const chargesResult = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total_charges FROM payment_charges WHERE payment_id = $1 AND deleted_at IS NULL',
      [id]
    );

    const totalCharges = parseFloat(chargesResult.rows[0].total_charges);
    const newTotal = payment.consultation_amount + totalCharges;

    // Update payment totals
    await client.query(
      `UPDATE payments
       SET total_additional_charges = $1, total_amount = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [totalCharges, newTotal, id]
    );

    await client.query('COMMIT');
    client.release();

    res.json(success(null, 'Charge deleted'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to delete charge'));
  }
});

// Update payment method (secretary only)
router.patch('/:id/payment-method', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const secretaryId = req.user!.id;

    // Validate payment method
    if (!paymentMethod || !['CASH', 'GCASH'].includes(paymentMethod)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid payment method. Must be CASH or GCASH'));
    }

    await client.query('BEGIN');

    // Get secretary's assigned doctor
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only update payments for your assigned doctor'));
    }

    // Only allow payment method changes when no payment has been recorded
    if (payment.amount_paid > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot change payment method after payment has been recorded'));
    }

    // Update payment method
    await client.query(
      `UPDATE payments
       SET payment_method = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [paymentMethod, id]
    );

    await client.query('COMMIT');
    client.release();

    res.json(success(null, 'Payment method updated successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to update payment method'));
  }
});

// Get payment by ID (for mobile notifications)
// This route uses a distinct path to avoid conflict with GET /:appointmentId
router.get('/by-id/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      queryText = `
        SELECT p.*, s.first_name as verified_by_first_name, s.last_name as verified_by_last_name
        FROM payments p
        LEFT JOIN secretaries s ON p.verified_by = s.id
        WHERE p.id = $1 AND p.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'SECRETARY') {
      // Secretary must be assigned to the payment's doctor
      const secretaryResult = await query(
        'SELECT doctor_id FROM secretaries WHERE user_id = $1',
        [userId]
      );

      if (secretaryResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
      }

      const assignedDoctorId = secretaryResult.rows[0].doctor_id;

      queryText = `
        SELECT p.*,
               pat.first_name as patient_first_name, pat.last_name as patient_last_name,
               s.first_name as verified_by_first_name, s.last_name as verified_by_last_name
        FROM payments p
        JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN secretaries s ON p.verified_by = s.id
        JOIN appointments a ON p.appointment_id = a.id
        WHERE p.id = $1 AND a.doctor_id = $2
      `;
      params.push(assignedDoctorId);
    } else if (role === 'ADMIN') {
      queryText = `
        SELECT p.*,
               pat.first_name as patient_first_name, pat.last_name as patient_last_name,
               s.first_name as verified_by_first_name, s.last_name as verified_by_last_name
        FROM payments p
        JOIN patients pat ON p.patient_id = pat.id
        LEFT JOIN secretaries s ON p.verified_by = s.id
        WHERE p.id = $1
      `;
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    // Get additional charges (excluding deleted charges)
    const chargesResult = await query(
      `SELECT
        pc.id,
        pc.charge_type,
        pc.description,
        pc.amount,
        pc.quantity,
        pc.unit_price,
        pc.prescription_item_id,
        pc.created_at,
        pc.created_by,
        s.first_name as created_by_first_name,
        s.last_name as created_by_last_name
       FROM payment_charges pc
       LEFT JOIN secretaries s ON pc.created_by = s.id
       WHERE pc.payment_id = $1 AND pc.deleted_at IS NULL`,
      [result.rows[0].id]
    );

    const payment = result.rows[0];
    payment.charges = chargesResult.rows;
    const balance = Math.max(0, parseFloat(payment.total_amount) - parseFloat(payment.amount_paid));
    payment.balance = balance.toFixed(2);

    res.json(success(payment));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payment'));
  }
});

// Get signed receipt URL (secretary only)
router.get('/:id/receipt-url', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

    // Get secretary's assigned doctor
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check
    const paymentResult = await query(
      `SELECT p.receipt_url, a.doctor_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       WHERE p.id = $1`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only view receipts for payments of your assigned doctor'));
    }

    if (!payment.receipt_url) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'No receipt uploaded for this payment'));
    }

    // Generate signed URL (valid for 60 seconds)
    const signedUrlResult = await generateSignedReceiptUrl(payment.receipt_url, 60);

    if (!signedUrlResult.success) {
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, signedUrlResult.error || 'Failed to generate signed URL'));
    }

    res.json(success({ signedUrl: signedUrlResult.signedUrl }, 'Signed URL generated successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to generate signed URL'));
  }
});

// Record payment (secretary only) - works for both walk-in and booked patients
router.post('/record', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { appointmentId, paymentMethod, consultationFee, additionalCharges } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!appointmentId) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'appointmentId is required'));
    }

    if (!paymentMethod || !['CASH', 'GCASH'].includes(paymentMethod)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'paymentMethod must be CASH or GCASH'));
    }

    if (consultationFee === undefined || consultationFee === null || isNaN(consultationFee) || consultationFee <= 0) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'consultationFee must be a positive number'));
    }

    // Validate additional charges if provided
    if (additionalCharges && Array.isArray(additionalCharges)) {
      for (const charge of additionalCharges) {
        const chargeType = charge.chargeType || 'ADDITIONAL';

        if (!['ADDITIONAL', 'MEDICINE'].includes(chargeType)) {
          client.release();
          return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid charge type. Must be ADDITIONAL or MEDICINE'));
        }

        if (chargeType === 'MEDICINE') {
          // Medicine charge validation
          if (!charge.name || typeof charge.name !== 'string' || charge.name.trim() === '') {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Medicine name is required for medicine charges'));
          }

          const quantity = Number(charge.quantity);
          if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Quantity must be a valid positive number for medicine charges'));
          }

          const unitPrice = Number(charge.unitPrice);
          if (isNaN(unitPrice) || !isFinite(unitPrice) || unitPrice <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Unit price must be a valid positive number for medicine charges'));
          }

          // Calculate amount on server (never trust client-supplied medicine total)
          charge.amount = quantity * unitPrice;
          charge.amount = Math.round(charge.amount * 100) / 100;
          charge.description = charge.name.trim();
        } else {
          // Additional charge validation
          if (!charge.description || typeof charge.description !== 'string' || charge.description.trim() === '') {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Each additional charge must have a non-empty description'));
          }
          if (charge.amount === undefined || charge.amount === null || isNaN(charge.amount) || charge.amount <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Each additional charge must have a positive amount'));
          }
        }
      }
    }

    await client.query('BEGIN');

    // Get secretary record and assigned doctor
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get appointment with doctor assignment check
    const appointmentResult = await client.query(
      `SELECT a.*, q.registration_source, p.user_id as patient_user_id
       FROM appointments a
       JOIN queue_entries q ON a.id = q.appointment_id
       JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    // Verify appointment belongs to secretary's assigned doctor
    if (appointment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only record payments for your assigned doctor'));
    }

    // Check if payment already exists for this appointment
    const existingPaymentResult = await client.query(
      'SELECT id, payment_method, status FROM payments WHERE appointment_id = $1',
      [appointmentId]
    );

    const isWalkIn = appointment.registration_source === 'WALK_IN';

    // For walk-in patients, payment should not exist yet
    // For booked patients, payment exists from booking
    if (isWalkIn && existingPaymentResult.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Payment already exists for this walk-in appointment'));
    }

    if (!isWalkIn && existingPaymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Payment record not found for booked appointment'));
    }

    // Calculate total amount
    const totalCharges = additionalCharges && additionalCharges.length > 0
      ? additionalCharges.reduce((sum: number, charge: any) => sum + parseFloat(charge.amount), 0)
      : 0;
    const totalAmount = parseFloat(consultationFee) + totalCharges;

    // Determine payment status
    // All payments start as UNPAID; secretary must explicitly mark CASH as PAID via /mark-paid
    // GCASH payments remain UNPAID until receipt is uploaded and verified
    const paymentStatus = 'UNPAID';
    const verifiedBy = null;
    const verifiedAt = null;

    let paymentId: string;

    if (isWalkIn) {
      // Create new payment record for walk-in patients
      const paymentInsertResult = await client.query(
        `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_additional_charges, total_amount, amount_paid, status, verified_by, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0.00, $7, $8, CURRENT_TIMESTAMP)
         RETURNING id`,
        [appointment.patient_id, appointmentId, paymentMethod, consultationFee, totalCharges, totalAmount, paymentStatus, verifiedBy]
      );
      paymentId = paymentInsertResult.rows[0].id;

      // Insert additional charges if provided
      if (additionalCharges && additionalCharges.length > 0) {
        for (const charge of additionalCharges) {
          const chargeType = charge.chargeType || 'ADDITIONAL';

          if (chargeType === 'MEDICINE') {
            await client.query(
              `INSERT INTO payment_charges (payment_id, charge_type, description, amount, quantity, unit_price, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [paymentId, 'MEDICINE', charge.description.trim(), parseFloat(charge.amount), Number(charge.quantity), Number(charge.unitPrice), secretaryRecordId]
            );
          } else {
            await client.query(
              `INSERT INTO payment_charges (payment_id, charge_type, description, amount, created_by)
               VALUES ($1, $2, $3, $4, $5)`,
              [paymentId, 'ADDITIONAL', charge.description.trim(), parseFloat(charge.amount), secretaryRecordId]
            );
          }
        }
      }
    } else {
      // Update existing payment record for booked patients
      paymentId = existingPaymentResult.rows[0].id;

      // Update payment method, status, and amounts (do not set amount_paid or change status automatically)
      await client.query(
        `UPDATE payments
         SET payment_method = $1,
             consultation_amount = $2,
             total_additional_charges = $3,
             total_amount = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [paymentMethod, consultationFee, totalCharges, totalAmount, paymentId]
      );

      // Delete existing charges and insert new ones
      await client.query('DELETE FROM payment_charges WHERE payment_id = $1', [paymentId]);

      if (additionalCharges && additionalCharges.length > 0) {
        for (const charge of additionalCharges) {
          const chargeType = charge.chargeType || 'ADDITIONAL';

          if (chargeType === 'MEDICINE') {
            await client.query(
              `INSERT INTO payment_charges (payment_id, charge_type, description, amount, quantity, unit_price, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [paymentId, 'MEDICINE', charge.description.trim(), parseFloat(charge.amount), Number(charge.quantity), Number(charge.unitPrice), secretaryRecordId]
            );
          } else {
            await client.query(
              `INSERT INTO payment_charges (payment_id, charge_type, description, amount, created_by)
               VALUES ($1, $2, $3, $4, $5)`,
              [paymentId, 'ADDITIONAL', charge.description.trim(), parseFloat(charge.amount), secretaryRecordId]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    client.release();

    res.json(success({ paymentId }, 'Payment recorded successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Payment recording error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to record payment'));
  }
});

// Record partial payment (secretary only) - for recording advance/partial payments on existing payments
router.patch('/:id/record-payment', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { amountReceived } = req.body;
    const secretaryId = req.user!.id;

    // Validate amount received
    if (amountReceived === undefined || amountReceived === null) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'amountReceived is required'));
    }

    const numericAmount = Number(amountReceived);
    if (isNaN(numericAmount) || !isFinite(numericAmount)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'amountReceived must be a valid number'));
    }

    if (numericAmount <= 0) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'amountReceived must be greater than zero'));
    }

    await client.query('BEGIN');

    // Get secretary's assigned doctor and secretary id
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [secretaryId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with doctor assignment check (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id, pat.user_id as patient_user_id
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       WHERE p.id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    // Verify payment belongs to secretary's assigned doctor
    if (payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only record payments for your assigned doctor'));
    }

    // Prevent updates to rejected, cancelled, or fully paid payments
    if (payment.status === 'REJECTED') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot record payment for a rejected payment'));
    }

    if (payment.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot record payment for a cancelled payment'));
    }

    if (payment.status === 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Payment is already fully paid'));
    }

    // Calculate current balance
    const currentAmountPaid = parseFloat(payment.amount_paid);
    const totalAmount = parseFloat(payment.total_amount);
    const currentBalance = Math.max(0, totalAmount - currentAmountPaid);

    // Calculate new amount paid (cumulative) - allow excess for change scenarios
    const newAmountPaid = currentAmountPaid + numericAmount;
    const newBalance = Math.max(0, totalAmount - newAmountPaid);

    // Update payment - only update amount_paid, do not change status
    // Secretary must explicitly use /mark-paid to mark as PAID
    await client.query(
      `UPDATE payments
       SET amount_paid = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newAmountPaid, id]
    );

    await client.query('COMMIT');
    client.release();

    res.json(success({
      amountPaid: newAmountPaid.toFixed(2),
      balance: newBalance.toFixed(2),
      status: payment.status
    }, 'Payment recorded successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to record payment'));
  }
});

// Record walk-in payment (secretary only) - DEPRECATED: Use /record instead
router.post('/walk-in', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { appointmentId, paymentMethod, consultationFee, additionalCharges } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!appointmentId) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'appointmentId is required'));
    }

    if (!paymentMethod || !['CASH', 'GCASH'].includes(paymentMethod)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'paymentMethod must be CASH or GCASH'));
    }

    if (consultationFee === undefined || consultationFee === null || isNaN(consultationFee) || consultationFee <= 0) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'consultationFee must be a positive number'));
    }

    // Validate additional charges if provided
    if (additionalCharges && Array.isArray(additionalCharges)) {
      for (const charge of additionalCharges) {
        const chargeType = charge.chargeType || 'ADDITIONAL';

        if (!['ADDITIONAL', 'MEDICINE'].includes(chargeType)) {
          client.release();
          return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid charge type. Must be ADDITIONAL or MEDICINE'));
        }

        if (chargeType === 'MEDICINE') {
          // Medicine charge validation
          if (!charge.name || typeof charge.name !== 'string' || charge.name.trim() === '') {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Medicine name is required for medicine charges'));
          }

          const quantity = Number(charge.quantity);
          if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Quantity must be a valid positive number for medicine charges'));
          }

          const unitPrice = Number(charge.unitPrice);
          if (isNaN(unitPrice) || !isFinite(unitPrice) || unitPrice <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Unit price must be a valid positive number for medicine charges'));
          }

          // Calculate amount on server (never trust client-supplied medicine total)
          charge.amount = quantity * unitPrice;
          charge.amount = Math.round(charge.amount * 100) / 100;
          charge.description = charge.name.trim();
        } else {
          // Additional charge validation
          if (!charge.description || typeof charge.description !== 'string' || charge.description.trim() === '') {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Each additional charge must have a non-empty description'));
          }
          if (charge.amount === undefined || charge.amount === null || isNaN(charge.amount) || charge.amount <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Each additional charge must have a positive amount'));
          }
        }
      }
    }

    await client.query('BEGIN');

    // Get secretary record and assigned doctor
    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [userId]
    );

    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get appointment with doctor assignment check
    const appointmentResult = await client.query(
      `SELECT a.*, q.registration_source, p.user_id as patient_user_id
       FROM appointments a
       JOIN queue_entries q ON a.id = q.appointment_id
       JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (appointmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
    }

    const appointment = appointmentResult.rows[0];

    // Verify appointment belongs to secretary's assigned doctor
    if (appointment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only record payments for your assigned doctor'));
    }

    // Verify this is a walk-in patient
    if (appointment.registration_source !== 'WALK_IN') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Payment recording is only available for walk-in patients'));
    }

    // Check if payment already exists for this appointment
    const existingPaymentResult = await client.query(
      'SELECT id FROM payments WHERE appointment_id = $1',
      [appointmentId]
    );

    if (existingPaymentResult.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Payment already exists for this appointment'));
    }

    // Calculate total amount
    const totalCharges = additionalCharges && additionalCharges.length > 0
      ? additionalCharges.reduce((sum: number, charge: any) => sum + parseFloat(charge.amount), 0)
      : 0;
    const totalAmount = parseFloat(consultationFee) + totalCharges;

    // Determine payment status
    // All payments start as UNPAID; secretary must explicitly mark CASH as PAID via /mark-paid
    // GCASH payments remain UNPAID until receipt is uploaded and verified
    const paymentStatus = 'UNPAID';

    // Insert payment record
    const paymentInsertResult = await client.query(
      `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_additional_charges, total_amount, amount_paid, status, verified_by, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0.00, $7, null, CURRENT_TIMESTAMP)
       RETURNING id`,
      [appointment.patient_id, appointmentId, paymentMethod, consultationFee, totalCharges, totalAmount, paymentStatus]
    );

    const paymentId = paymentInsertResult.rows[0].id;

    // Insert additional charges if provided
    if (additionalCharges && additionalCharges.length > 0) {
      for (const charge of additionalCharges) {
        await client.query(
          `INSERT INTO payment_charges (payment_id, description, amount, created_by)
           VALUES ($1, $2, $3, $4)`,
          [paymentId, charge.description.trim(), parseFloat(charge.amount), secretaryRecordId]
        );
      }
    }

    await client.query('COMMIT');
    client.release();

    res.json(success({ paymentId }, 'Payment recorded successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to record payment'));
  }
});

export default router;