import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';

const router = Router();

// Get payment for appointment
router.get('/:appointmentId', authenticate, async (req: AuthRequest, res: Response) => {
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
    } else if (role === 'SECRETARY' || role === 'ADMIN') {
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

    // Get additional charges
    const chargesResult = await query(
      'SELECT * FROM payment_charges WHERE payment_id = $1',
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
router.post('/:appointmentId/receipt', authenticate, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { receiptUrl } = req.body;

    if (!receiptUrl) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Receipt URL is required'));
    }

    // Check if payment exists
    const existingResult = await query(
      'SELECT * FROM payments WHERE appointment_id = $1',
      [appointmentId]
    );

    if (existingResult.rows.length > 0) {
      // Update existing payment
      await query(
        `UPDATE payments 
         SET receipt_url = $1, status = 'PENDING_VERIFICATION', updated_at = CURRENT_TIMESTAMP 
         WHERE appointment_id = $2`,
        [receiptUrl, appointmentId]
      );
    } else {
      // Create new payment record
      const appointmentResult = await query(
        'SELECT * FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (appointmentResult.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Appointment not found'));
      }

      const appointment = appointmentResult.rows[0];

      // Get consultation fee
      const doctorResult = await query(
        'SELECT consultation_fee FROM doctors WHERE id = $1',
        [appointment.doctor_id]
      );

      const consultationFee = doctorResult.rows[0].consultation_fee;

      await query(
        `INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_amount, status, receipt_url)
         VALUES ($1, $2, 'GCASH', $3, $3, 'PENDING_VERIFICATION', $4)`,
        [appointment.patient_id, appointmentId, consultationFee, receiptUrl]
      );
    }

    res.json(success(null, 'Receipt uploaded successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to upload receipt'));
  }
});

// Verify payment (secretary only)
router.patch('/:id/verify', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

    const paymentResult = await query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    if (payment.status === 'PAID') {
      return res.status(400).json(error(ErrorCodes.PAYMENT_ALREADY_VERIFIED, 'Payment already verified'));
    }

    if (payment.status !== 'PENDING_VERIFICATION') {
      return res.status(400).json(error(ErrorCodes.PAYMENT_VERIFICATION_REQUIRED, 'Payment is not in pending verification status'));
    }

    await query(
      `UPDATE payments 
       SET status = 'PAID', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [secretaryId, id]
    );

    res.json(success(null, 'Payment verified successfully'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to verify payment'));
  }
});

// Reject payment (secretary only)
router.patch('/:id/reject', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const secretaryId = req.user!.id;

    const paymentResult = await query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'PENDING_VERIFICATION') {
      return res.status(400).json(error(ErrorCodes.PAYMENT_VERIFICATION_REQUIRED, 'Payment is not in pending verification status'));
    }

    await query(
      `UPDATE payments 
       SET status = 'REJECTED', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [secretaryId, id]
    );

    res.json(success(null, 'Payment rejected'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to reject payment'));
  }
});

// Add additional charge (secretary only)
router.post('/:id/charges', authenticate, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { description, amount } = req.body;
    const secretaryId = req.user!.id;

    if (!description || !amount) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Description and amount are required'));
    }

    const paymentResult = await query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Payment not found'));
    }

    // Add charge
    await query(
      `INSERT INTO payment_charges (payment_id, description, amount, created_by)
       VALUES ($1, $2, $3, $4)`,
      [id, description, amount, secretaryId]
    );

    // Recalculate total
    const chargesResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total_charges FROM payment_charges WHERE payment_id = $1',
      [id]
    );

    const totalCharges = parseFloat(chargesResult.rows[0].total_charges);
    const newTotal = paymentResult.rows[0].consultation_amount + totalCharges;

    await query(
      `UPDATE payments 
       SET total_additional_charges = $1, total_amount = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [totalCharges, newTotal, id]
    );

    res.json(success(null, 'Additional charge added'));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to add charge'));
  }
});

export default router;