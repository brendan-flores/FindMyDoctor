import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize, requireSecretaryPasswordChange, requireSecretaryProfileCompletion } from '../middleware/auth';
import { generateInvoicePdf } from '../services/invoicePdfService';

const router = Router();

// Generate and create invoice for a paid payment (secretary only)
router.post('/generate/:paymentId', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { paymentId } = req.params;
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

    const secretaryRecordId = secretaryResult.rows[0].id;
    const assignedDoctorId = secretaryResult.rows[0].doctor_id;

    // Get payment with full details (lock row for update)
    const paymentResult = await client.query(
      `SELECT p.*,
              a.appointment_date,
              a.reason_for_visit,
              a.doctor_id,
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
      [paymentId]
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
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only generate invoices for your assigned doctor'));
    }

    // Only generate invoices for PAID payments
    if (payment.status !== 'PAID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invoice can only be generated for paid payments'));
    }

    // Check if an ACTIVE invoice already exists for this payment
    const existingInvoiceResult = await client.query(
      'SELECT id, status FROM invoices WHERE payment_id = $1',
      [paymentId]
    );

    if (existingInvoiceResult.rows.length > 0) {
      const existingInvoice = existingInvoiceResult.rows[0];
      if (existingInvoice.status === 'ACTIVE') {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'An active invoice already exists for this payment. Void the existing invoice first.'));
      }
      // If invoice is VOID, we can proceed to generate a new ACTIVE invoice
    }

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
      [paymentId]
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
        final_balance: finalBalance
      }
    };

    // Insert invoice record
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        invoice_number, payment_id, doctor_id, patient_id, invoice_date,
        subtotal, total_amount, advance_payment, remaining_balance_before_payment,
        payment_method, cash_tendered, amount_applied, change_amount, final_balance,
        invoice_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        invoiceNumber,
        paymentId,
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

    await client.query('COMMIT');
    client.release();

    const invoice = invoiceResult.rows[0];
    invoice.invoice_data = invoiceData; // Return parsed JSONB

    res.json(success(invoice, 'Invoice generated successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error('Invoice generation error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, `Failed to generate invoice: ${err.message}`));
  }
});

// Get invoice by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'SECRETARY') {
      // Secretary must be assigned to the invoice's doctor
      queryText = `
        SELECT i.*
        FROM invoices i
        WHERE i.id = $1 AND i.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'PATIENT') {
      // Patient can only view their own invoices
      queryText = `
        SELECT i.*
        FROM invoices i
        WHERE i.id = $1 AND i.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      // Doctor can view invoices for their patients
      queryText = `
        SELECT i.*
        FROM invoices i
        WHERE i.id = $1 AND i.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'ADMIN') {
      // Admin can view all invoices
      queryText = 'SELECT i.* FROM invoices i WHERE i.id = $1';
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Invoice not found'));
    }

    const invoice = result.rows[0];
    invoice.invoice_data = typeof invoice.invoice_data === 'string' ? JSON.parse(invoice.invoice_data) : invoice.invoice_data;

    res.json(success(invoice));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch invoice'));
  }
});

// Get invoice by payment ID
router.get('/by-payment/:paymentId', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { paymentId } = req.params;
    const { includeVoid } = req.query;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [paymentId];

    // If includeVoid is not set, only return ACTIVE invoices
    const statusFilter = includeVoid === 'true' ? '' : "AND i.status = 'ACTIVE'";

    if (role === 'SECRETARY') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.payment_id = $1 AND i.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2) ${statusFilter}
      `;
      params.push(userId);
    } else if (role === 'PATIENT') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.payment_id = $1 AND i.patient_id = (SELECT id FROM patients WHERE user_id = $2) ${statusFilter}
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.payment_id = $1 AND i.doctor_id = (SELECT id FROM doctors WHERE user_id = $2) ${statusFilter}
      `;
      params.push(userId);
    } else if (role === 'ADMIN') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.payment_id = $1 ${statusFilter}
      `;
    } else {
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await client.query(queryText, params);

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Invoice not found'));
    }

    const invoice = result.rows[0];
    const invoiceData = typeof invoice.invoice_data === 'string' ? JSON.parse(invoice.invoice_data) : invoice.invoice_data;

    // Always update invoice data with current payment data from database
    const advancePayment = parseFloat(invoice.gcash_advance_amount || '0');
    const cashTendered = parseFloat(invoice.cash_tendered_amount || '0');
    const totalAmount = parseFloat(invoice.total_amount || '0');
    const amountPaid = parseFloat(invoice.amount_paid || '0');

    const remainingBalanceBeforePayment = Math.max(0, totalAmount - advancePayment);
    const amountApplied = Math.min(cashTendered, remainingBalanceBeforePayment);
    const changeAmount = Math.max(0, cashTendered - amountApplied);
    const finalBalance = Math.max(0, totalAmount - amountPaid);

    invoiceData.payment.advance_payment = advancePayment;
    invoiceData.payment.cash_tendered = cashTendered;
    invoiceData.payment.amount_applied = amountApplied;
    invoiceData.payment.change_amount = changeAmount;
    invoiceData.payment.final_balance = finalBalance;
    invoiceData.payment.remaining_balance_before_payment = remainingBalanceBeforePayment;

    // Update the invoice in database if values changed
    await client.query('BEGIN');
    await client.query(
      `UPDATE invoices SET
        advance_payment = $1,
        cash_tendered = $2,
        amount_applied = $3,
        change_amount = $4,
        final_balance = $5,
        remaining_balance_before_payment = $6,
        invoice_data = $7
      WHERE id = $8`,
      [
        advancePayment,
        cashTendered,
        amountApplied,
        changeAmount,
        finalBalance,
        remainingBalanceBeforePayment,
        JSON.stringify(invoiceData),
        invoice.id
      ]
    );
    await client.query('COMMIT');

    client.release();
    res.json(success({ ...invoice, invoice_data: invoiceData }));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error('Invoice fetch error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch invoice'));
  }
});

// Void invoice (secretary only)
router.post('/:id/void', authenticate, requireSecretaryPasswordChange, requireSecretaryProfileCompletion, authorize('SECRETARY'), async (req: AuthRequest, res: Response) => {
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

    // Get invoice with doctor assignment check (lock row for update)
    const invoiceResult = await client.query(
      'SELECT * FROM invoices WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Invoice not found'));
    }

    const invoice = invoiceResult.rows[0];

    // Verify invoice belongs to secretary's assigned doctor
    if (invoice.doctor_id !== assignedDoctorId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'You can only void invoices for your assigned doctor'));
    }

    // Check if invoice is already voided
    if (invoice.status === 'VOID') {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Invoice is already voided'));
    }

    // Update invoice status to VOID
    await client.query(
      'UPDATE invoices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['VOID', id]
    );

    await client.query('COMMIT');
    client.release();

    // Return updated invoice
    const updatedInvoice = { ...invoice, status: 'VOID' };
    updatedInvoice.invoice_data = typeof updatedInvoice.invoice_data === 'string' ? JSON.parse(updatedInvoice.invoice_data) : updatedInvoice.invoice_data;

    res.json(success(updatedInvoice, 'Invoice voided successfully'));
  } catch (err: any) {
    try {
      await client.query('ROLLBACK');
      client.release();
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error('Invoice voiding error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, `Failed to void invoice: ${err.message}`));
  }
});

// Download invoice as PDF
router.get('/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'SECRETARY') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.id = $1 AND i.doctor_id = (SELECT doctor_id FROM secretaries WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'PATIENT') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.id = $1 AND i.patient_id = (SELECT id FROM patients WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.id = $1 AND i.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
      `;
      params.push(userId);
    } else if (role === 'ADMIN') {
      queryText = `
        SELECT i.*, p.gcash_advance_amount, p.cash_tendered_amount, p.total_amount, p.amount_paid
        FROM invoices i
        JOIN payments p ON i.payment_id = p.id
        WHERE i.id = $1
      `;
    } else {
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await client.query(queryText, params);

    if (result.rows.length === 0) {
      client.release();
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Invoice not found'));
    }

    const invoice = result.rows[0];

    // Reject PDF download for voided invoices
    if (invoice.status === 'VOID') {
      client.release();
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Cannot download PDF for voided invoice'));
    }

    const invoiceData = typeof invoice.invoice_data === 'string' ? JSON.parse(invoice.invoice_data) : invoice.invoice_data;

    // Update invoice data with current payment data to ensure PDF matches preview
    const advancePayment = parseFloat(invoice.gcash_advance_amount || '0');
    const cashTendered = parseFloat(invoice.cash_tendered_amount || '0');
    const totalAmount = parseFloat(invoice.total_amount || '0');
    const amountPaid = parseFloat(invoice.amount_paid || '0');

    const remainingBalanceBeforePayment = Math.max(0, totalAmount - advancePayment);
    const amountApplied = Math.min(cashTendered, remainingBalanceBeforePayment);
    const changeAmount = Math.max(0, cashTendered - amountApplied);
    const finalBalance = Math.max(0, totalAmount - amountPaid);

    invoiceData.payment.advance_payment = advancePayment;
    invoiceData.payment.cash_tendered = cashTendered;
    invoiceData.payment.amount_applied = amountApplied;
    invoiceData.payment.change_amount = changeAmount;
    invoiceData.payment.final_balance = finalBalance;
    invoiceData.payment.remaining_balance_before_payment = remainingBalanceBeforePayment;

    // Add invoice number and date to the data
    invoiceData.invoice_number = invoice.invoice_number;
    invoiceData.invoice_date = invoice.invoice_date;

    client.release();

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Accept-Ranges', 'none');

    res.send(pdfBuffer);
  } catch (err: any) {
    try {
      client.release();
    } catch (releaseErr) {
      console.error('Client release failed:', releaseErr);
    }
    console.error('PDF generation error:', err);
    console.error('Error details:', err.message, err.stack);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, `Failed to generate PDF: ${err.message}`));
  }
});

export default router;
