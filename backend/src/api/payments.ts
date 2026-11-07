import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import { sendPushToUser } from '../services/pushService';
import multer from 'multer';
import { uploadPaymentReceipt, validatePaymentReceiptFile, generateSignedReceiptUrl } from '../services/storageService';
import { createNotification, NotificationTypes } from './notifications';
import { recalculateBill, logBillingAction, getBillingSummary, getPaymentWithBilling } from '../services/billingService';

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
        pat.date_of_birth as patient_date_of_birth,
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

      // Calculate patient age from date of birth
      let patientAge: number | null = null;
      if (payment.patient_date_of_birth) {
        const dob = new Date(payment.patient_date_of_birth);
        const today = new Date();
        patientAge = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          patientAge--;
        }
      }

      return {
        ...payment,
        patient_age: patientAge,
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
    const patientDeclaredAmount = req.body.patient_declared_amount ? parseFloat(req.body.patient_declared_amount) : null;

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

    let paymentId: string;

    if (existingResult.rows.length > 0) {
      paymentId = existingResult.rows[0].id;
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

      const insertResult = await client.query(
        `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_amount, gcash_advance_amount, cash_tendered_amount, status, receipt_url)
         VALUES ($1, $2, 'GCASH', $3, $3, 0.00, 0.00, 'PENDING_VERIFICATION', $4)
         RETURNING id`,
        [appointment.patient_id, appointmentId, consultationFee, receiptPath]
      );
      paymentId = insertResult.rows[0].id;
    }

    // Create a pending payment_transaction for the uploaded receipt
    // Amount defaults to the bill total; secretary can adjust on accept
    const billTotalResult = await client.query(
      `SELECT COALESCE(consultation_amount, 0) + COALESCE(total_additional_charges, 0) as bill_total
       FROM payments WHERE id = $1`,
      [paymentId]
    );
    const declaredOrBillTotal = patientDeclaredAmount ?? parseFloat(billTotalResult.rows[0]?.bill_total || 0);

    await client.query(
      `INSERT INTO payment_transactions (
        payment_id, kind, method, amount, receipt_url, patient_declared_amount,
        source, created_by, status, created_at
      ) VALUES ($1, 'PAYMENT', 'GCASH', $2, $3, $4, 'PATIENT_UPLOAD', $5, 'PENDING', CURRENT_TIMESTAMP)`,
      [paymentId, declaredOrBillTotal, receiptPath, patientDeclaredAmount, req.user!.id]
    );

    await recalculateBill(paymentId, client);

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

// Get signed receipt URL for the authenticated patient (patient only)
// GET /payments/my-receipt/:appointmentId
router.get('/my-receipt/:appointmentId', authenticate, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const patientUserId = req.user!.id;

    console.log('=== My Receipt URL Request ===');
    console.log('Appointment ID:', appointmentId);
    console.log('Patient User ID:', patientUserId);

    // Verify the appointment belongs to this patient
    const result = await query(
      `SELECT p.receipt_url, pt.receipt_url as tx_receipt_url
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON a.patient_id = pat.id
       LEFT JOIN LATERAL (
         SELECT receipt_url FROM payment_transactions
         WHERE payment_id = p.id AND receipt_url IS NOT NULL
         ORDER BY created_at DESC LIMIT 1
       ) pt ON true
       WHERE p.appointment_id = $1 AND pat.user_id = $2`,
      [appointmentId, patientUserId]
    );

    if (result.rows.length === 0) {
      console.log('Payment not found for this appointment/patient');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const receiptPath = result.rows[0].receipt_url || result.rows[0].tx_receipt_url;
    console.log('Receipt path from DB:', receiptPath);
    console.log('Payments.receipt_url:', result.rows[0].receipt_url);
    console.log('Transaction receipt_url:', result.rows[0].tx_receipt_url);

    if (!receiptPath) {
      console.log('No receipt URL found in either payments or payment_transactions');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'No receipt uploaded for this payment'));
    }

    console.log('Generating signed URL for path:', receiptPath);
    const signedUrlResult = await generateSignedReceiptUrl(receiptPath, 300);

    if (!signedUrlResult.success) {
      console.error('Failed to generate signed URL:', signedUrlResult.error);
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, signedUrlResult.error || 'Failed to generate signed URL'));
    }

    console.log('Signed URL generated:', signedUrlResult.signedUrl);
    res.json(success({ signedUrl: signedUrlResult.signedUrl }, 'Signed URL generated successfully'));
  } catch (err: any) {
    console.error('Error in my-receipt endpoint:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to generate signed URL'));
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

    // Update payment verification metadata and set gcash_advance_amount for GCash payments
    // Secretary must explicitly use /mark-paid to mark a verified GCash payment as PAID
    const updateQuery = payment.payment_method === 'GCASH'
      ? `UPDATE payments
         SET verified_by = $1, verified_at = CURRENT_TIMESTAMP, gcash_advance_amount = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`
      : `UPDATE payments
         SET verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`;

    const updateParams = payment.payment_method === 'GCASH'
      ? [secretaryRecordId, payment.total_amount, id]
      : [secretaryRecordId, id];

    await client.query(updateQuery, updateParams);

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
      `SELECT p.*, a.doctor_id, a.appointment_date, a.reason_for_visit,
              pat.user_id as patient_user_id,
              pat.first_name as patient_first_name,
              pat.last_name as patient_last_name,
              pat.phone as patient_phone,
              pat.address as patient_address,
              pat.date_of_birth as patient_dob,
              pat.sex as patient_sex,
              u.email as patient_email,
              d.first_name as doctor_first_name,
              d.last_name as doctor_last_name,
              d.specialty,
              d.practice_name,
              d.consultation_fee
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN users u ON pat.user_id = u.id
       JOIN doctors d ON a.doctor_id = d.id
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
    // Preserve payment method amounts if partial payments were already recorded
    let updateQuery = 'UPDATE payments SET status = $1, amount_paid = $2, verified_by = $3, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP';
    const updateParams: any[] = ['PAID', payment.total_amount, secretaryRecordId];

    // Only set payment method amounts if they are currently 0 (no partial payments recorded)
    // This preserves amounts recorded via recordPartialPayment for split payment scenarios
    // DO NOT overwrite either column if it has a value, as split payments (GCash + cash) are now supported
    const currentGcashAdvance = parseFloat(payment.gcash_advance_amount || '0');
    const currentCashTendered = parseFloat(payment.cash_tendered_amount || '0');

    if (currentGcashAdvance === 0 && currentCashTendered === 0) {
      // No partial payments recorded - set the appropriate column based on payment method
      if (payment.payment_method === 'GCASH') {
        updateQuery += ', gcash_advance_amount = $4';
        updateParams.push(payment.total_amount);
      } else if (payment.payment_method === 'CASH') {
        updateQuery += ', cash_tendered_amount = $4';
        updateParams.push(payment.total_amount);
      }
    }
    // If either column has a value, preserve both - don't overwrite anything

    updateQuery += ' WHERE id = $' + (updateParams.length + 1);
    updateParams.push(id);

    await client.query(updateQuery, updateParams);

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

    // Automatically generate invoice for the paid payment (only if fully paid)
    // Check if invoice already exists
    const existingInvoiceResult = await client.query(
      'SELECT id FROM invoices WHERE payment_id = $1',
      [id]
    );

    // Only generate invoice if payment is fully paid (no remaining balance)
    const totalAmount = parseFloat(payment.total_amount || '0');
    const amountPaid = parseFloat(payment.amount_paid || '0');
    const isFullyPaid = amountPaid >= totalAmount;

    if (existingInvoiceResult.rows.length === 0 && isFullyPaid) {
      // Get invoice settings for the doctor
      const invoiceSettingsResult = await client.query(
        'SELECT clinic_name, address, contact_number, footer_line FROM invoice_settings WHERE doctor_id = $1',
        [assignedDoctorId]
      );

      const invoiceSettings = invoiceSettingsResult.rows[0] || {
        clinic_name: payment.practice_name || 'Find My Doctor',
        address: '',
        contact_number: '',
        footer_line: 'Thank you for your visit!'
      };

      // Get payment charges
      const chargesResult = await client.query(
        `SELECT pc.charge_type, pc.description, pc.amount, pc.quantity, pc.unit_price
         FROM payment_charges pc
         WHERE pc.payment_id = $1 AND pc.deleted_at IS NULL`,
        [id]
      );

      // Calculate amounts
      const consultationAmount = parseFloat(payment.consultation_amount || '0');
      const chargesTotal = chargesResult.rows.reduce((sum, charge) => sum + parseFloat(charge.amount || '0'), 0);
      const subtotal = consultationAmount + chargesTotal;
      const totalAmount = parseFloat(payment.total_amount || '0');
      const amountPaid = parseFloat(payment.amount_paid || '0');
      const advancePayment = parseFloat(payment.gcash_advance_amount || '0');
      const cashTendered = parseFloat(payment.cash_tendered_amount || '0');
      const remainingBalanceBeforePayment = Math.max(0, totalAmount - advancePayment);
      const amountApplied = Math.min(cashTendered, remainingBalanceBeforePayment);
      const changeAmount = Math.max(0, cashTendered - amountApplied);
      const finalBalance = Math.max(0, totalAmount - amountPaid);

      // Generate sequential invoice number per doctor
      const lastInvoiceResult = await client.query(
        `SELECT invoice_number FROM invoices WHERE doctor_id = $1 ORDER BY invoice_number DESC LIMIT 1`,
        [assignedDoctorId]
      );

      let nextInvoiceNumber = 1;
      if (lastInvoiceResult.rows.length > 0) {
        const lastInvoiceNumber = lastInvoiceResult.rows[0].invoice_number;
        const numericPart = parseInt(lastInvoiceNumber.replace(/\D/g, '')) || 0;
        nextInvoiceNumber = numericPart + 1;
      }

      const invoiceNumber = `INV-${String(nextInvoiceNumber).padStart(4, '0')}`;

      // Fetch payment transactions for snapshot in invoice
      const transactionsResult = await client.query(
        `SELECT id, kind, method, amount, status, reference_no FROM payment_transactions WHERE payment_id = $1 AND status = 'ACCEPTED' ORDER BY created_at`,
        [id]
      );
      const acceptedTransactions = transactionsResult.rows;

      // Prepare invoice data JSONB
      const invoiceData = {
        clinic: {
          name: invoiceSettings.clinic_name,
          address: invoiceSettings.address,
          contact_number: invoiceSettings.contact_number,
          footer_line: invoiceSettings.footer_line
        },
        doctor: {
          first_name: payment.doctor_first_name,
          last_name: payment.doctor_last_name,
          specialty: payment.specialty,
          practice_name: payment.practice_name
        },
        patient: {
          first_name: payment.patient_first_name,
          last_name: payment.patient_last_name,
          email: payment.patient_email,
          phone: payment.patient_phone,
          address: payment.patient_address,
          date_of_birth: payment.patient_dob,
          sex: payment.patient_sex
        },
        appointment: {
          date: payment.appointment_date,
          reason_for_visit: payment.reason_for_visit
        },
        charges: chargesResult.rows.map(charge => ({
          charge_type: charge.charge_type,
          description: charge.description,
          amount: parseFloat(charge.amount || '0'),
          quantity: charge.quantity ? parseFloat(charge.quantity) : null,
          unit_price: charge.unit_price ? parseFloat(charge.unit_price) : null
        })),
        payment: {
          consultation_amount: consultationAmount,
          charges_total: chargesTotal,
          subtotal: subtotal,
          total_amount: totalAmount,
          advance_payment: advancePayment,
          remaining_balance_before_payment: remainingBalanceBeforePayment,
          payment_method: payment.payment_method,
          cash_tendered: cashTendered,
          amount_applied: amountApplied,
          change_amount: changeAmount,
          final_balance: finalBalance,
          transactions: acceptedTransactions.map(tx => ({
            id: tx.id,
            kind: tx.kind,
            method: tx.method,
            amount: parseFloat(tx.amount),
            status: tx.status,
            reference_no: tx.reference_no
          }))
        }
      };

      // Insert invoice record
      await client.query(
        `INSERT INTO invoices (
          invoice_number, payment_id, doctor_id, patient_id, invoice_date,
          subtotal, total_amount, advance_payment, remaining_balance_before_payment,
          payment_method, cash_tendered, amount_applied, change_amount, final_balance,
          invoice_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          invoiceNumber,
          id,
          assignedDoctorId,
          payment.patient_id,
          new Date(),
          subtotal,
          totalAmount,
          advancePayment,
          remainingBalanceBeforePayment,
          payment.payment_method,
          cashTendered,
          amountApplied,
          changeAmount,
          finalBalance,
          JSON.stringify(invoiceData)
        ]
      );
    }

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
    if (!['ADDITIONAL', 'MEDICINE', 'SERVICE', 'OTHER'].includes(finalChargeType)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid charge type. Must be ADDITIONAL, MEDICINE, SERVICE, or OTHER'));
    }

    // Unit-based charges (medicine, service, other) are priced as qty × unit price.
    const unitBased = ['MEDICINE', 'SERVICE', 'OTHER'].includes(finalChargeType);

    let chargeAmount: number;
    let chargeDescription: string;

    if (unitBased) {
      const chargeName = typeof name === 'string' && name.trim() !== ''
        ? name
        : (typeof description === 'string' ? description : '');

      if (!chargeName || chargeName.trim() === '') {
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Name is required for this charge'));
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

      // Calculate amount on server (never trust a client-supplied line total)
      chargeAmount = numericQuantity * numericUnitPrice;
      chargeDescription = chargeName.trim();

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

    // Charges stay editable until an ACTIVE invoice exists. After that the bill
    // is locked and the secretary must use "Edit bill…" (void + replace).
    const activeInvoiceResult = await client.query(
      `SELECT id, invoice_number FROM invoices
        WHERE payment_id = $1 AND status = 'ACTIVE'
        LIMIT 1`,
      [id]
    );
    if (activeInvoiceResult.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `INVOICE_LOCKED: Invoice ${activeInvoiceResult.rows[0].invoice_number} is active. Edit the bill to change charges.`
      ));
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
    let chargeInsertResult;
    if (unitBased) {
      chargeInsertResult = await client.query(
        `INSERT INTO payment_charges (payment_id, charge_type, description, amount, quantity, unit_price, prescription_item_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [id, finalChargeType, chargeDescription, chargeAmount, Number(quantity), Number(unitPrice), prescriptionItemId || null, secretaryRecordId]
      );
    } else {
      chargeInsertResult = await client.query(
        `INSERT INTO payment_charges (payment_id, charge_type, description, amount, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [id, 'ADDITIONAL', chargeDescription, chargeAmount, secretaryRecordId]
      );
    }
    const chargeId = chargeInsertResult?.rows?.[0]?.id;

    // Recalculate total from authoritative charge records (excluding deleted charges)
    const chargesResult = await client.query(
      'SELECT COALESCE(SUM(amount)::numeric, 0) as total_charges FROM payment_charges WHERE payment_id = $1 AND deleted_at IS NULL',
      [id]
    );

    const totalCharges = parseFloat(chargesResult.rows[0].total_charges);
    const newTotal = parseFloat(payment.consultation_amount) + totalCharges;

    await client.query(
      `UPDATE payments
          SET total_additional_charges = $1, total_amount = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [totalCharges, newTotal, id]
    );

    // Status/balance are always derived by the server, never by the client or
    // by manual status flips. Adding a charge to a paid bill moves it back to
    // PARTIAL (or UNPAID when nothing has been paid).
    const billingStatus = await recalculateBill(id, client, newTotal);

    await logBillingAction(
      id,
      userId,
      'CHARGE_ADDED',
      'payment_charge',
      chargeId,
      { total_amount: payment.total_amount, status: payment.status },
      { total_amount: newTotal, status: billingStatus, charge_amount: chargeAmount, charge_type: finalChargeType },
      undefined,
      client
    );

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

    res.json(success({
      totalAmount: newTotal,
      status: billingStatus,
      chargeAmount,
      chargeType: finalChargeType,
    }, 'Additional charge added'));
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

    // Charges are locked once an ACTIVE invoice exists.
    const activeInvoiceResult = await client.query(
      `SELECT id, invoice_number FROM invoices
        WHERE payment_id = $1 AND status = 'ACTIVE'
        LIMIT 1`,
      [id]
    );
    if (activeInvoiceResult.rows.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `INVOICE_LOCKED: Invoice ${activeInvoiceResult.rows[0].invoice_number} is active. Edit the bill to change charges.`
      ));
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

    // Removing a charge must never leave the bill overpaid. Compare the total
    // after removal with accepted payments minus refunds before soft-deleting.
    const chargesSumResult = await client.query(
      'SELECT COALESCE(SUM(amount)::numeric, 0) as total_charges FROM payment_charges WHERE payment_id = $1 AND deleted_at IS NULL',
      [id]
    );
    const totalChargesBefore = parseFloat(chargesSumResult.rows[0].total_charges);
    const totalChargesAfter = Math.max(0, totalChargesBefore - parseFloat(chargeResult.rows[0].amount));
    const newTotal = parseFloat(payment.consultation_amount) + totalChargesAfter;

    const paidResult = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'PAYMENT' AND status = 'ACCEPTED' THEN amount ELSE 0 END), 0) as accepted_payments,
         COALESCE(SUM(CASE WHEN kind = 'REFUND' AND status = 'ACCEPTED' THEN amount ELSE 0 END), 0) as accepted_refunds
       FROM payment_transactions
       WHERE payment_id = $1`,
      [id]
    );
    const acceptedPayments = parseFloat(paidResult.rows[0].accepted_payments || 0);
    const acceptedRefunds = parseFloat(paidResult.rows[0].accepted_refunds || 0);
    const netPaid = acceptedPayments - acceptedRefunds;

    if (netPaid > newTotal + 0.005) {
      const overpayAmount = (netPaid - newTotal).toFixed(2);
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        `Removing this would overpay the bill by ₱${overpayAmount}. Void a payment first.`
      ));
    }

    // Soft-delete the charge by setting deleted_at
    await client.query(
      'UPDATE payment_charges SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [chargeId]
    );

    await client.query(
      `UPDATE payments
          SET total_additional_charges = $1, total_amount = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [totalChargesAfter, newTotal, id]
    );

    // Recalculate status server-side. Removing a charge on a paid bill can make
    // it OVERPAID, which is exactly what the guard above prevents.
    const billingStatus = await recalculateBill(id, client, newTotal);

    await logBillingAction(
      id,
      userId,
      'CHARGE_REMOVED',
      'payment_charge',
      chargeId,
      { total_amount: payment.total_amount, status: payment.status, charge_amount: parseFloat(chargeResult.rows[0].amount) },
      { total_amount: newTotal, status: billingStatus },
      undefined,
      client
    );

    await client.query('COMMIT');
    client.release();

    res.json(success({
      totalAmount: newTotal,
      status: billingStatus,
    }, 'Charge deleted'));
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

// Revert payment to unpaid (secretary only)
router.patch('/:id/revert-unpaid', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

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
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only revert payments for your assigned doctor'));
    }

    // Only allow reverting PAID payments
    if (payment.status !== 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Only PAID payments can be reverted to unpaid'));
    }

    // Update payment status to UNPAID
    await client.query(
      `UPDATE payments
       SET status = 'UNPAID', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    client.release();

    res.json(success(null, 'Payment reverted to unpaid successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to revert payment to unpaid'));
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

        if (!['ADDITIONAL', 'MEDICINE', 'SERVICE', 'OTHER'].includes(chargeType)) {
          client.release();
          return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid charge type. Must be ADDITIONAL, MEDICINE, SERVICE, or OTHER'));
        }

        if (chargeType !== 'ADDITIONAL') {
          // Unit-based charge validation (medicine, service, other)
          if (!charge.name || typeof charge.name !== 'string' || charge.name.trim() === '') {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'A name is required for this charge'));
          }

          const quantity = Number(charge.quantity);
          if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Quantity must be a valid positive number for this charge'));
          }

          const unitPrice = Number(charge.unitPrice);
          if (isNaN(unitPrice) || !isFinite(unitPrice) || unitPrice <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Unit price must be a valid positive number for this charge'));
          }

          // Calculate amount on server (never trust client-supplied totals)
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
      // Determine initial payment method amounts
      const gcashAdvanceAmount = paymentMethod === 'GCASH' ? 0.00 : 0.00;
      const cashTenderedAmount = paymentMethod === 'CASH' ? 0.00 : 0.00;

      // Create new payment record for walk-in patients
      const paymentInsertResult = await client.query(
        `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_additional_charges, total_amount, amount_paid, gcash_advance_amount, cash_tendered_amount, status, verified_by, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0.00, $7, $8, $9, $10, CURRENT_TIMESTAMP)
         RETURNING id`,
        [appointment.patient_id, appointmentId, paymentMethod, consultationFee, totalCharges, totalAmount, gcashAdvanceAmount, cashTenderedAmount, paymentStatus, verifiedBy]
      );
      paymentId = paymentInsertResult.rows[0].id;

      // Insert additional charges if provided
      if (additionalCharges && additionalCharges.length > 0) {
        for (const charge of additionalCharges) {
          const chargeType = charge.chargeType || 'ADDITIONAL';

          if (chargeType !== 'ADDITIONAL') {
            await client.query(
              `INSERT INTO payment_charges (payment_id, charge_type, description, amount, quantity, unit_price, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [paymentId, chargeType, charge.description.trim(), parseFloat(charge.amount), Number(charge.quantity), Number(charge.unitPrice), secretaryRecordId]
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

      // Determine payment method amounts based on payment method
      // Note: For booked patients, these will be updated later when actual payments are recorded
      const gcashAdvanceAmount = paymentMethod === 'GCASH' ? 0.00 : 0.00;
      const cashTenderedAmount = paymentMethod === 'CASH' ? 0.00 : 0.00;

      // Update payment method, status, and amounts (do not set amount_paid or change status automatically)
      await client.query(
        `UPDATE payments
         SET payment_method = $1,
             consultation_amount = $2,
             total_additional_charges = $3,
             total_amount = $4,
             gcash_advance_amount = $5,
             cash_tendered_amount = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [paymentMethod, consultationFee, totalCharges, totalAmount, gcashAdvanceAmount, cashTenderedAmount, paymentId]
      );

      // Delete existing charges and insert new ones
      await client.query('DELETE FROM payment_charges WHERE payment_id = $1', [paymentId]);

      if (additionalCharges && additionalCharges.length > 0) {
        for (const charge of additionalCharges) {
          const chargeType = charge.chargeType || 'ADDITIONAL';

          if (chargeType !== 'ADDITIONAL') {
            await client.query(
              `INSERT INTO payment_charges (payment_id, charge_type, description, amount, quantity, unit_price, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [paymentId, chargeType, charge.description.trim(), parseFloat(charge.amount), Number(charge.quantity), Number(charge.unitPrice), secretaryRecordId]
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
    const { amountReceived, paymentMethodType } = req.body;
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

    // Validate payment method type if provided
    if (paymentMethodType && !['GCASH', 'CASH'].includes(paymentMethodType)) {
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'paymentMethodType must be GCASH or CASH'));
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

    // Build update query based on payment method type
    let updateQuery = 'UPDATE payments SET amount_paid = $1, updated_at = CURRENT_TIMESTAMP';
    const updateParams: any[] = [newAmountPaid];

    if (paymentMethodType === 'GCASH') {
      // Update gcash_advance_amount
      const currentGcashAdvance = parseFloat(payment.gcash_advance_amount || '0');
      const newGcashAdvance = currentGcashAdvance + numericAmount;
      updateQuery += ', gcash_advance_amount = $2';
      updateParams.push(newGcashAdvance);
    } else if (paymentMethodType === 'CASH') {
      // Update cash_tendered_amount
      const currentCashTendered = parseFloat(payment.cash_tendered_amount || '0');
      const newCashTendered = currentCashTendered + numericAmount;
      updateQuery += ', cash_tendered_amount = $2';
      updateParams.push(newCashTendered);
    }

    updateQuery += ' WHERE id = $' + (updateParams.length + 1);
    updateParams.push(id);

    await client.query(updateQuery, updateParams);

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

        if (!['ADDITIONAL', 'MEDICINE', 'SERVICE', 'OTHER'].includes(chargeType)) {
          client.release();
          return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invalid charge type. Must be ADDITIONAL, MEDICINE, SERVICE, or OTHER'));
        }

        if (chargeType !== 'ADDITIONAL') {
          // Unit-based charge validation (medicine, service, other)
          if (!charge.name || typeof charge.name !== 'string' || charge.name.trim() === '') {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'A name is required for this charge'));
          }

          const quantity = Number(charge.quantity);
          if (isNaN(quantity) || !isFinite(quantity) || quantity <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Quantity must be a valid positive number for this charge'));
          }

          const unitPrice = Number(charge.unitPrice);
          if (isNaN(unitPrice) || !isFinite(unitPrice) || unitPrice <= 0) {
            client.release();
            return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Unit price must be a valid positive number for this charge'));
          }

          // Calculate amount on server (never trust client-supplied totals)
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

// ============================================================================
// BILLING REDESIGN ENDPOINTS (payment_transactions based)
// ============================================================================

const secAuth = [authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY')];

// GET /payments/:id/billing - bill + charges + transactions + derived status by payment ID
router.get('/:id/billing', ...secAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id: paymentId } = req.params;
    const billingData = await getPaymentWithBilling(paymentId);
    res.json(success({
      payment: billingData.payment,
      charges: billingData.charges,
      transactions: billingData.transactions,
      billingSummary: billingData.billingSummary,
      activeInvoice: billingData.activeInvoice,
    }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payment details'));
  }
});

// GET /payments/by-appointment/:appointmentId - bill + charges + transactions + derived status
router.get('/by-appointment/:appointmentId', ...secAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const paymentResult = await query('SELECT id FROM payments WHERE appointment_id = $1', [appointmentId]);
    if (paymentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found for this appointment'));
    }
    const billingData = await getPaymentWithBilling(paymentResult.rows[0].id);
    res.json(success({
      payment: billingData.payment,
      charges: billingData.charges,
      transactions: billingData.transactions,
      billingSummary: billingData.billingSummary,
      activeInvoice: billingData.activeInvoice,
    }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payment details'));
  }
});

// POST /payments/:id/transactions - record payment/refund transaction
router.post('/:id/transactions', ...secAuth, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { id: paymentId } = req.params;
    const { kind, method, amount, receipt_url, reference_no, patient_declared_amount, source } = req.body;

    if (!kind || !method || !amount || amount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'kind, method, and a positive amount are required'));
    }
    if (method === 'GCASH' && !reference_no) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'REFERENCE_NO_REQUIRED: Reference number is required for GCash payments'));
    }

    const paymentResult = await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);
    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const invoiceResult = await client.query(
      `SELECT id FROM invoices WHERE payment_id = $1 AND status = 'ACTIVE' LIMIT 1`, [paymentId]);
    if (invoiceResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Cannot add payments - ACTIVE invoice exists'));
    }

    // Guard against double-submits: the payment row lock above serialises
    // concurrent requests, so a second identical request sees the first one.
    const duplicateResult = await client.query(
      `SELECT id FROM payment_transactions
        WHERE payment_id = $1
          AND kind = $2
          AND method = $3
          AND amount = $4
          AND COALESCE(reference_no, '') = COALESCE($5, '')
          AND status IN ('ACCEPTED', 'PENDING')
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 seconds'
        LIMIT 1`,
      [paymentId, kind, method, Number(amount), reference_no || null]
    );
    if (duplicateResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json(error(ErrorCodes.CONFLICT, 'An identical payment was just recorded for this bill. Refresh and try again.'));
    }

    const txResult = await client.query(
      `INSERT INTO payment_transactions (
        payment_id, kind, method, amount, receipt_url, reference_no,
        patient_declared_amount, source, created_by, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACCEPTED', CURRENT_TIMESTAMP)
      RETURNING *`,
      [paymentId, kind, method, amount, receipt_url || null, reference_no || null,
       patient_declared_amount || null, source || 'SECRETARY', req.user!.id]
    );

    await recalculateBill(paymentId, client);
    await logBillingAction(paymentId, req.user!.id, 'TRANSACTION_CREATED', 'payment_transaction',
      txResult.rows[0].id, {}, txResult.rows[0], undefined, client);

    await client.query('COMMIT');
    res.status(201).json(success(txResult.rows[0], 'Payment recorded successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to record payment'));
  } finally {
    client.release();
  }
});

// PATCH /payments/:id/transactions/:txId/accept - accept pending receipt
router.patch('/:id/transactions/:txId/accept', ...secAuth, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { id: paymentId, txId } = req.params;
    const { amount, reference_no } = req.body;

    const txResult = await client.query(
      'SELECT * FROM payment_transactions WHERE id = $1 AND payment_id = $2', [txId, paymentId]);
    if (txResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Transaction not found'));
    }
    if (txResult.rows[0].status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Transaction is not pending'));
    }

    const updated = await client.query(
      `UPDATE payment_transactions SET status = 'ACCEPTED',
        amount = COALESCE($1, amount), reference_no = COALESCE($2, reference_no),
        reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [amount || null, reference_no || null, req.user!.id, txId]);

    await recalculateBill(paymentId, client);
    await logBillingAction(paymentId, req.user!.id, 'TRANSACTION_ACCEPTED', 'payment_transaction',
      txId, txResult.rows[0], updated.rows[0], undefined, client);

    await client.query('COMMIT');
    res.json(success(updated.rows[0], 'Receipt accepted successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to accept receipt'));
  } finally {
    client.release();
  }
});

// PATCH /payments/:id/transactions/:txId/reject - reject pending receipt (reason required)
router.patch('/:id/transactions/:txId/reject', ...secAuth, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { id: paymentId, txId } = req.params;
    const { reason, note } = req.body;

    if (!reason) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Rejection reason is required'));
    }

    const txResult = await client.query(
      'SELECT * FROM payment_transactions WHERE id = $1 AND payment_id = $2', [txId, paymentId]);
    if (txResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Transaction not found'));
    }
    if (txResult.rows[0].status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Transaction is not pending'));
    }

    const updated = await client.query(
      `UPDATE payment_transactions SET status = 'REJECTED',
        reject_reason = $1, reject_note = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [reason, note || null, req.user!.id, txId]);

    await recalculateBill(paymentId, client);
    await logBillingAction(paymentId, req.user!.id, 'TRANSACTION_REJECTED', 'payment_transaction',
      txId, txResult.rows[0], updated.rows[0], reason, client);

    await client.query('COMMIT');
    res.json(success(updated.rows[0], 'Receipt rejected'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reject receipt'));
  } finally {
    client.release();
  }
});

// PATCH /payments/:id/transactions/:txId/void - void accepted transaction (reason required)
router.patch('/:id/transactions/:txId/void', ...secAuth, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { id: paymentId, txId } = req.params;
    const { reason, note } = req.body;

    if (!reason) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'VOID_REASON_REQUIRED: Void reason is required'));
    }

    const txResult = await client.query(
      'SELECT * FROM payment_transactions WHERE id = $1 AND payment_id = $2', [txId, paymentId]);
    if (txResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Transaction not found'));
    }
    if (txResult.rows[0].status === 'VOIDED') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Transaction is already voided'));
    }

    // If ACTIVE invoice exists, void it too
    const invoiceResult = await client.query(
      `SELECT * FROM invoices WHERE payment_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1`,
      [paymentId]);

    const updated = await client.query(
      `UPDATE payment_transactions SET status = 'VOIDED',
        void_reason = $1, void_note = $2, voided_by = $3, voided_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [reason, note || null, req.user!.id, txId]);

    if (invoiceResult.rows.length > 0) {
      await client.query(
        `UPDATE invoices SET status = 'VOID', voided_by = $1, voided_at = CURRENT_TIMESTAMP,
          void_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [req.user!.id, reason, invoiceResult.rows[0].id]);
    }

    await recalculateBill(paymentId, client);
    await logBillingAction(paymentId, req.user!.id, 'TRANSACTION_VOIDED', 'payment_transaction',
      txId, txResult.rows[0], updated.rows[0], reason, client);

    await client.query('COMMIT');
    res.json(success(updated.rows[0], 'Payment voided successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to void payment'));
  } finally {
    client.release();
  }
});

// POST /payments/:id/refunds - refund entry (only when OVERPAID)
router.post('/:id/refunds', ...secAuth, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { id: paymentId } = req.params;
    const { method, amount, reason, reference_no } = req.body;

    if (!method || !amount || amount <= 0 || !reason) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'method, a positive amount, and reason are required'));
    }

    const summary = await getBillingSummary(paymentId);
    if (summary.billingStatus !== 'OVERPAID') {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'PAYMENT_NOT_OVERPAID: Refunds are only allowed when bill is overpaid'));
    }
    const overpaid = summary.netPaid - summary.billTotal;
    if (amount > overpaid) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Refund amount exceeds overpaid amount'));
    }

    const txResult = await client.query(
      `INSERT INTO payment_transactions (
        payment_id, kind, method, amount, reference_no, source, created_by, status, created_at
      ) VALUES ($1, 'REFUND', $2, $3, $4, 'SECRETARY', $5, 'ACCEPTED', CURRENT_TIMESTAMP)
      RETURNING *`,
      [paymentId, method, amount, reference_no || null, req.user!.id]);

    await recalculateBill(paymentId, client);
    await logBillingAction(paymentId, req.user!.id, 'REFUND_CREATED', 'payment_transaction',
      txResult.rows[0].id, {}, txResult.rows[0], reason, client);

    await client.query('COMMIT');
    res.status(201).json(success(txResult.rows[0], 'Refund recorded successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create refund'));
  } finally {
    client.release();
  }
});

// POST /payments/:id/invoice - issue invoice (only when balance == 0)
// Locks the payment row so two secretaries cannot both issue an invoice, and
// links a replacement to the voided invoice it supersedes.
router.post('/:id/invoice', ...secAuth, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { id: paymentId } = req.params;

    const secretaryResult = await client.query(
      'SELECT id, doctor_id FROM secretaries WHERE user_id = $1',
      [req.user!.id]
    );
    if (secretaryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Lock the payment row for the whole invoice transaction. `FOR UPDATE OF p`
    // avoids trying to lock the nullable side of the LEFT JOINs.
    const paymentResult = await client.query(
      `SELECT p.*, a.doctor_id, a.appointment_date, a.reason_for_visit,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              d.specialty, d.practice_name,
              pat.first_name as patient_first_name, pat.last_name as patient_last_name,
              u.email as patient_email, pat.phone as patient_phone,
              pat.address as patient_address, pat.date_of_birth as patient_date_of_birth,
              pat.sex as patient_sex
       FROM payments p
       LEFT JOIN appointments a ON p.appointment_id = a.id
       LEFT JOIN doctors d ON a.doctor_id = d.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN users u ON u.id = pat.user_id
       WHERE p.id = $1
       FOR UPDATE OF p`,
      [paymentId]
    );
    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }
    const payment = paymentResult.rows[0];

    // Doctor assignment: walk-in payments may not have an appointment, so fall
    // back to the secretary's assigned doctor.
    if (payment.doctor_id && payment.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only issue invoices for your assigned doctor'));
    }
    const doctorId = payment.doctor_id || assignedDoctorId;
    const patientId = payment.patient_id;

    const existingInvoice = await client.query(
      `SELECT id, invoice_number FROM invoices WHERE payment_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [paymentId]
    );
    if (existingInvoice.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'INVOICE_ALREADY_ACTIVE: An active invoice already exists'));
    }

    // Derive the bill + balance from the same locked client, never from a
    // separate connection (that would not see this transaction's rows).
    const billTotal =
      parseFloat(payment.consultation_amount || '0') + parseFloat(payment.total_additional_charges || '0');

    const transactionsResult = await client.query(
      `SELECT id, kind, method, amount, status, reference_no, created_at
         FROM payment_transactions
        WHERE payment_id = $1
        ORDER BY created_at ASC`,
      [paymentId]
    );
    const acceptedTransactions = transactionsResult.rows.filter((tx: any) => tx.status === 'ACCEPTED');
    const acceptedPayments = acceptedTransactions
      .filter((tx: any) => tx.kind === 'PAYMENT')
      .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0);
    const acceptedRefunds = acceptedTransactions
      .filter((tx: any) => tx.kind === 'REFUND')
      .reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0);
    const netPaid = acceptedPayments - acceptedRefunds;
    const balance = Math.max(0, billTotal - netPaid);

    if (balance > 0.005) {
      await client.query('ROLLBACK');
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'BILL_BALANCE_NOT_ZERO: Cannot issue invoice - balance is not zero'));
    }

    const chargesResult = await client.query(
      `SELECT charge_type, description, amount, quantity, unit_price
         FROM payment_charges
        WHERE payment_id = $1 AND deleted_at IS NULL
        ORDER BY created_at ASC`,
      [paymentId]
    );

    const invoiceSettingsResult = await client.query(
      'SELECT clinic_name, address, contact_number, footer_line FROM invoice_settings WHERE doctor_id = $1',
      [doctorId]
    );
    const invoiceSettings = invoiceSettingsResult.rows[0] || {
      clinic_name: payment.practice_name || 'Find My Doctor',
      address: '',
      contact_number: '',
      footer_line: 'Thank you for your visit!',
    };

    // Find the voided invoice this one replaces (if any).
    const priorInvoiceResult = await client.query(
      `SELECT * FROM invoices
        WHERE payment_id = $1 AND status = 'VOID' AND replaced_by_invoice_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [paymentId]
    );
    const priorInvoice = priorInvoiceResult.rows[0] || null;

    const nextNum = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1 as next_num
       FROM invoices WHERE doctor_id = $1 AND invoice_number LIKE 'INV-%'`,
      [doctorId]
    );
    const invoiceNumber = `INV-${String(nextNum.rows[0].next_num).padStart(4, '0')}`;

    const invoiceData = {
      invoice_number: invoiceNumber,
      invoice_date: new Date(),
      replaces_invoice_number: priorInvoice?.invoice_number || null,
      clinic: {
        name: invoiceSettings.clinic_name,
        address: invoiceSettings.address,
        contact_number: invoiceSettings.contact_number,
        footer_line: invoiceSettings.footer_line,
      },
      doctor: {
        first_name: payment.doctor_first_name,
        last_name: payment.doctor_last_name,
        specialty: payment.specialty,
        practice_name: payment.practice_name,
      },
      patient: {
        first_name: payment.patient_first_name,
        last_name: payment.patient_last_name,
        email: payment.patient_email,
        phone: payment.patient_phone,
        address: payment.patient_address,
        date_of_birth: payment.patient_date_of_birth,
        sex: payment.patient_sex,
      },
      appointment: {
        date: payment.appointment_date,
        reason_for_visit: payment.reason_for_visit,
      },
      charges: chargesResult.rows.map((charge: any) => ({
        charge_type: charge.charge_type,
        description: charge.description,
        name: charge.description,
        amount: parseFloat(charge.amount || '0'),
        quantity: charge.quantity ? parseFloat(charge.quantity) : null,
        unit_price: charge.unit_price ? parseFloat(charge.unit_price) : null,
      })),
      payment: {
        consultation_amount: parseFloat(payment.consultation_amount || '0'),
        charges_total: parseFloat(payment.total_additional_charges || '0'),
        subtotal: billTotal,
        total_amount: billTotal,
        advance_payment: acceptedPayments,
        remaining_balance_before_payment: 0,
        payment_method: payment.payment_method || 'CASH',
        cash_tendered: acceptedPayments,
        amount_applied: acceptedPayments,
        change_amount: 0,
        final_balance: balance,
        transactions: acceptedTransactions.map((tx: any) => ({
          id: tx.id,
          kind: tx.kind,
          method: tx.method,
          amount: parseFloat(tx.amount || '0'),
          status: tx.status,
          reference_no: tx.reference_no,
          created_at: tx.created_at,
        })),
      },
    };

    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        invoice_number, payment_id, doctor_id, patient_id, invoice_date,
        subtotal, total_amount, advance_payment, remaining_balance_before_payment,
        payment_method, cash_tendered, amount_applied, change_amount, final_balance,
        invoice_data, status, replaces_invoice_id, created_at
      ) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,'ACTIVE',$14,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        invoiceNumber,
        paymentId,
        doctorId,
        patientId,
        billTotal,
        billTotal,
        acceptedPayments,
        balance,
        payment.payment_method || 'CASH',
        acceptedPayments,
        acceptedPayments,
        balance,
        JSON.stringify(invoiceData),
        priorInvoice?.id || null,
      ]
    );

    if (priorInvoice) {
      await client.query(
        `UPDATE invoices SET replaced_by_invoice_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [invoiceResult.rows[0].id, priorInvoice.id]
      );
    }

    await logBillingAction(
      paymentId,
      req.user!.id,
      priorInvoice ? 'INVOICE_REISSUED' : 'INVOICE_CREATED',
      'invoice',
      invoiceResult.rows[0].id,
      priorInvoice ? { invoice_id: priorInvoice.id, invoice_number: priorInvoice.invoice_number, status: 'VOID' } : {},
      {
        invoice_id: invoiceResult.rows[0].id,
        invoice_number: invoiceNumber,
        replaces_invoice_number: priorInvoice?.invoice_number || null,
      },
      priorInvoice ? `Replaces ${priorInvoice.invoice_number}` : undefined,
      client
    );

    await client.query('COMMIT');
    res.status(201).json(success({ ...invoiceResult.rows[0], invoice_data: invoiceData }, 'Invoice issued successfully'));
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Issue invoice error:', err);
    if (err?.code === '23505') {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'INVOICE_ALREADY_ACTIVE: An active invoice already exists'));
    }
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to issue invoice'));
  } finally {
    client.release();
  }
});

// Secretary billing list endpoints live on a dedicated router mounted at
// /api/v1/secretary so paths match /secretary/payments/{review,collect,history}.
export const secretaryPaymentsRouter = Router();
const secListAuth = [requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY')];

// GET /secretary/payments/review - pending receipts across assigned doctor
secretaryPaymentsRouter.get('/payments/review', ...secListAuth, async (req: AuthRequest, res: Response) => {
  try {
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1', [req.user!.id]);
    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }
    const doctorId = secretaryResult.rows[0].doctor_id;
    const result = await query(
      `SELECT pt.*, p.appointment_id, p.consultation_amount, p.total_additional_charges,
              pat.first_name as patient_first_name, pat.last_name as patient_last_name,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM payment_transactions pt
       JOIN payments p ON pt.payment_id = p.id
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE pt.status = 'PENDING' AND a.doctor_id = $1
       ORDER BY pt.created_at DESC`, [doctorId]);
    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch pending receipts'));
  }
});

// GET /secretary/payments/collect - completed visits with balance > 0
secretaryPaymentsRouter.get('/payments/collect', ...secListAuth, async (req: AuthRequest, res: Response) => {
  try {
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1', [req.user!.id]);
    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }
    const doctorId = secretaryResult.rows[0].doctor_id;
    const result = await query(
      `SELECT p.*, pat.first_name as patient_first_name, pat.last_name as patient_last_name,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name
       FROM payments p
       JOIN appointments a ON p.appointment_id = a.id
       JOIN patients pat ON p.patient_id = pat.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.doctor_id = $1
         AND p.status IN ('UNPAID','PARTIAL','FOR_REVIEW','PENDING_VERIFICATION')
       ORDER BY p.created_at ASC`, [doctorId]);
    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payments to collect'));
  }
});

// GET /secretary/payments/history?date= - issued invoices + day summary
secretaryPaymentsRouter.get('/payments/history', ...secListAuth, async (req: AuthRequest, res: Response) => {
  try {
    const secretaryResult = await query(
      'SELECT doctor_id FROM secretaries WHERE user_id = $1', [req.user!.id]);
    if (secretaryResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Secretary profile not found'));
    }
    const doctorId = secretaryResult.rows[0].doctor_id;
    const { date } = req.query;
    const dateFilter = date ? 'AND DATE(i.created_at) = $2' : '';
    const params: any[] = [doctorId];
    if (date) params.push(date);

    const result = await query(
      `SELECT i.*, p.appointment_id, pat.first_name as patient_first_name, pat.last_name as patient_last_name
       FROM invoices i
       JOIN payments p ON i.payment_id = p.id
       JOIN patients pat ON i.patient_id = pat.id
       WHERE i.doctor_id = $1 AND i.status = 'ACTIVE' ${dateFilter}
       ORDER BY i.created_at DESC`, params);

    const summaryResult = await query(
      `SELECT
         SUM(CASE WHEN pt.kind = 'PAYMENT' AND pt.method = 'CASH' AND pt.status = 'ACCEPTED' THEN pt.amount ELSE 0 END) as cash_total,
         SUM(CASE WHEN pt.kind = 'PAYMENT' AND pt.method = 'GCASH' AND pt.status = 'ACCEPTED' THEN pt.amount ELSE 0 END) as gcash_total,
         SUM(CASE WHEN pt.kind = 'PAYMENT' AND pt.status = 'ACCEPTED' THEN pt.amount ELSE 0 END)
           - SUM(CASE WHEN pt.kind = 'REFUND' AND pt.status = 'ACCEPTED' THEN pt.amount ELSE 0 END) as grand_total
       FROM payment_transactions pt
       JOIN payments p ON pt.payment_id = p.id
       JOIN invoices i ON p.id = i.payment_id
       WHERE i.doctor_id = $1 AND i.status = 'ACTIVE' AND pt.status = 'ACCEPTED'
         ${date ? 'AND DATE(i.created_at) = $2' : ''}`,
      params);
    const s = summaryResult.rows[0] || {};

    res.json(success({
      invoices: result.rows,
      summary: {
        cashTotal: parseFloat(s.cash_total || 0),
        gcashTotal: parseFloat(s.gcash_total || 0),
        grandTotal: parseFloat(s.grand_total || 0),
      }
    }));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch payment history'));
  }
});

export default router;