import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import { sendPushToUser } from '../services/pushService';
import multer from 'multer';
import { uploadPaymentReceipt, validatePaymentReceiptFile, generateSignedReceiptUrl } from '../services/storageService';

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
    if (status && !['UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED'].includes(status as string)) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid status filter. Valid values: UNPAID, PENDING_VERIFICATION, PAID, REJECTED'));
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
          pc.description,
          pc.amount,
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

    const payments = result.rows.map(payment => ({
      ...payment,
      charges: chargesByPayment.get(payment.id) || [],
    }));

    res.json(success(payments));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payments'));
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
        pc.description,
        pc.amount,
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

    // Update payment status
    await client.query(
      `UPDATE payments
       SET status = 'PAID', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [secretaryRecordId, id]
    );

    // Insert notification for patient
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'PAYMENT_VERIFIED', 'Payment Verified', 'Your payment has been verified.', 'payment', $2)`,
      [payment.patient_user_id, id]
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Payment Verified',
        body: 'Your payment has been verified.',
        data: {
          type: 'PAYMENT_VERIFIED',
          paymentId: id,
        },
      });
    } catch (pushErr) {
      console.error('Push delivery failed:', pushErr);
    }

    res.json(success(null, 'Payment verified successfully'));
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

    // Get charge breakdown for notification
    const chargesResult = await client.query(
      `SELECT description, amount FROM payment_charges WHERE payment_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [id]
    );

    // Recalculate total amount to ensure it includes all charges
    const totalCharges = chargesResult.rows.reduce((sum: number, c: any) => sum + parseFloat(c.amount), 0);
    const totalAmount = parseFloat(payment.consultation_amount) + totalCharges;

    // Build charge breakdown message
    let chargeBreakdown = '';
    if (chargesResult.rows.length > 0) {
      chargeBreakdown = chargesResult.rows.map((c: any) => `• ${c.description}: ₱${parseFloat(c.amount).toFixed(2)}`).join('\n');
    }

    const notificationMessage = `Your payment of ₱${totalAmount.toFixed(2)} was rejected. Please contact the clinic.${chargeBreakdown ? '\n\nCharges:\n' + chargeBreakdown : ''}`;

    // Insert notification for patient with charge breakdown
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'PAYMENT_REJECTED', 'Payment Rejected', $2, 'payment', $3)`,
      [payment.patient_user_id, notificationMessage, id]
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Payment Rejected',
        body: `Your payment of ₱${totalAmount.toFixed(2)} was rejected. Please contact the clinic.`,
        data: {
          type: 'PAYMENT_REJECTED',
          paymentId: id,
          amount: totalAmount.toString(),
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

    if (payment.status !== 'UNPAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Only unpaid cash payments can be marked as paid'));
    }

    // Update payment status
    await client.query(
      `UPDATE payments
       SET status = 'PAID', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [secretaryRecordId, id]
    );

    // Insert notification for patient
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_entity_type, related_entity_id)
       VALUES ($1, 'PAYMENT_VERIFIED', 'Payment Received', 'Your cash payment has been received.', 'payment', $2)`,
      [payment.patient_user_id, id]
    );

    await client.query('COMMIT');
    client.release();

    // Send push notification (best-effort, outside transaction)
    try {
      await sendPushToUser(payment.patient_user_id, {
        title: 'Payment Received',
        body: 'Your cash payment has been received.',
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
    const { description, amount } = req.body;
    const userId = req.user!.id;

    // Validate description and amount
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

    // Insert charge
    await client.query(
      `INSERT INTO payment_charges (payment_id, description, amount, created_by)
       VALUES ($1, $2, $3, $4)`,
      [id, description.trim(), numericAmount, secretaryRecordId]
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

    // Insert notification for patient with charge amount
    const notificationMessage = `An additional charge of ₱${numericAmount.toFixed(2)} has been added to your payment.`;
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
          amount: numericAmount.toString(),
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

// Get payment by ID (for mobile notifications)
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
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
        pc.description,
        pc.amount,
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

export default router;