import { Router, Response } from 'express';
import { query, getClient } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { createNotification, NotificationTypes } from './notifications';
import { sendPushToUser } from '../services/pushService';
import { generateSignedPrescriptionUrl } from '../services/storageService';
import { generatePrescriptionPdfFile } from '../services/prescriptionPdfService';

const router = Router();

// Get authenticated patient's prescriptions (PATIENT-only)
router.get('/me', authenticate, authorize('PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get patient ID from user
    const patientResult = await query(
      'SELECT id FROM patients WHERE user_id = $1',
      [userId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Patient not found'));
    }

    const patientId = patientResult.rows[0].id;

    // Get all prescriptions for this patient
    const result = await query(
      `SELECT p.*,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name,
              CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url != '' THEN true ELSE false END as has_pdf,
              (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = p.id) as medication_count
       FROM prescriptions p
       JOIN doctors d ON p.doctor_id = d.id
       WHERE p.patient_id = $1 AND p.status = 'ISSUED'
       ORDER BY p.prescription_date DESC`,
      [patientId]
    );

    res.json(success(result.rows));
  } catch (err: any) {
    console.error('Error fetching patient prescriptions:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch prescriptions'));
  }
});

// Create prescription (doctor must own the visit; issued visits only)
router.post('/', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { visitId, items, notes } = req.body;

    if (!visitId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Visit ID and items are required'));
    }

    const doctorResult = await query('SELECT id FROM doctors WHERE user_id = $1', [req.user!.id]);
    if (doctorResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Doctor profile not found'));
    }
    const doctorId = doctorResult.rows[0].id;

    // Get visit details
    const visitResult = await query(
      'SELECT * FROM visits WHERE id = $1 AND doctor_id = $2',
      [visitId, doctorId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'ISSUED') {
      return res.status(400).json(error(
        ErrorCodes.VALIDATION_ERROR,
        'The visit must be issued from the consultation workspace before a prescription can be created'
      ));
    }

    const activeResult = await query(
      `SELECT id FROM prescriptions WHERE visit_id = $1 AND status = 'ISSUED' LIMIT 1`,
      [visitId]
    );
    if (activeResult.rows.length > 0) {
      return res.status(409).json(error(
        ErrorCodes.CONFLICT,
        'Void the existing prescription before issuing a replacement'
      ));
    }

    const voidedResult = await query(
      `SELECT id FROM prescriptions
       WHERE visit_id = $1 AND status = 'VOIDED'
       ORDER BY voided_at DESC
       LIMIT 1`,
      [visitId]
    );
    const replacesId = voidedResult.rows[0]?.id || null;

    // Create the prescription and its items atomically.
    const client = await getClient();
    let prescription;
    try {
      await client.query('BEGIN');

      const prescriptionResult = await client.query(
        `INSERT INTO prescriptions
           (visit_id, patient_id, doctor_id, prescription_date, notes, status, replaces_prescription_id)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, 'ISSUED', $5)
         RETURNING *`,
        [visitId, visit.patient_id, doctorId, notes || null, replacesId]
      );

      const prescriptionId = prescriptionResult.rows[0].id;

      for (const item of items) {
        if (!item?.medicationName || typeof item.medicationName !== 'string') continue;
        await client.query(
          `INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions, quantity)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            prescriptionId,
            item.medicationName,
            item.dosage || null,
            item.frequency || null,
            item.duration || null,
            item.instructions || null,
            item.quantity ?? null,
          ]
        );
      }

      await client.query('COMMIT');
      prescription = prescriptionResult.rows[0];
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    } finally {
      client.release();
    }

    const prescriptionId = prescription.id;

    // Create notification for patient (best-effort, does not block prescription creation)
    const patientUserResult = await query(
      'SELECT user_id FROM patients WHERE id = $1',
      [visit.patient_id]
    );

    if (patientUserResult.rows.length > 0) {
      const patientUserId = patientUserResult.rows[0].user_id;
      try {
        const isReplacement = Boolean(replacesId);
        await createNotification(
          patientUserId,
          isReplacement ? NotificationTypes.PRESCRIPTION_UPDATED : NotificationTypes.PRESCRIPTION_AVAILABLE,
          isReplacement ? 'Prescription Updated' : 'New Prescription Available',
          isReplacement
            ? 'Your doctor updated your prescription. View it in your prescriptions.'
            : 'Your doctor has issued a new prescription. View it in your prescriptions.',
          'prescription',
          prescriptionId
        );

        // Send push notification (best-effort, failures are logged and never block)
        await sendPushToUser(patientUserId, {
          title: isReplacement ? 'Prescription Updated' : 'New Prescription Available',
          body: isReplacement
            ? 'Your doctor updated your prescription.'
            : 'Your doctor has issued a new prescription.',
          data: {
            type: isReplacement ? 'PRESCRIPTION_UPDATED' : 'PRESCRIPTION_AVAILABLE',
            prescriptionId,
          },
        });
      } catch (notificationError) {
        console.error('Failed to create notification or send push for prescription:', notificationError);
        // Do not fail the prescription creation if notification fails
      }
    }

    res.status(201).json(success(prescription, 'Prescription created successfully'));
  } catch (err: any) {
    console.error('Create prescription error:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to create prescription'));
  }
});

// Get prescription by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      queryText = `
        SELECT p.*,
               d.first_name as doctor_first_name, d.last_name as doctor_last_name,
               v.visit_date,
               CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url != '' THEN true ELSE false END as has_pdf
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        JOIN visits v ON p.visit_id = v.id
        WHERE p.id = $1 AND p.patient_id = (SELECT id FROM patients WHERE user_id = $2)
          AND p.status = 'ISSUED'
      `;
      params.push(userId);
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT p.*,
               pat.first_name as patient_first_name, pat.last_name as patient_last_name,
               v.visit_date,
               CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url != '' THEN true ELSE false END as has_pdf
        FROM prescriptions p
        JOIN patients pat ON p.patient_id = pat.id
        JOIN visits v ON p.visit_id = v.id
        WHERE p.id = $1 AND p.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
    }

    // Get prescription items
    const itemsResult = await query(
      'SELECT * FROM prescription_items WHERE prescription_id = $1',
      [id]
    );

    const prescription = result.rows[0];
    prescription.items = itemsResult.rows;

    res.json(success(prescription));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch prescription'));
  }
});

// Get patient's prescriptions (owning patient or doctor only)
router.get('/patients/:id', authenticate, authorize('PATIENT', 'DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let queryText = '';
    const params = [id];

    if (role === 'PATIENT') {
      // Verify patient owns the records
      const patientResult = await query(
        'SELECT id FROM patients WHERE user_id = $1',
        [userId]
      );

      if (patientResult.rows.length === 0 || patientResult.rows[0].id !== id) {
        // Return non-disclosing 404 to avoid revealing whether the patient exists
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Not found'));
      }

      queryText = `
        SELECT p.*,
               d.first_name as doctor_first_name, d.last_name as doctor_last_name,
               CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url != '' THEN true ELSE false END as has_pdf
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = $1 AND p.status = 'ISSUED'
        ORDER BY p.prescription_date DESC
      `;
    } else if (role === 'DOCTOR') {
      queryText = `
        SELECT p.*,
               d.first_name as doctor_first_name, d.last_name as doctor_last_name,
               CASE WHEN p.pdf_url IS NOT NULL AND p.pdf_url != '' THEN true ELSE false END as has_pdf
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = $1 AND p.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)
        ORDER BY p.prescription_date DESC
      `;
      params.push(userId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    // Attach items for any caller that may read the prescription (patient/doctor).
    if (result.rows.length > 0) {
      const prescriptionIds = result.rows.map((p: any) => p.id);
      const itemsResult = await query(
        'SELECT * FROM prescription_items WHERE prescription_id = ANY($1::uuid[]) ORDER BY created_at ASC',
        [prescriptionIds]
      );

      const itemsByPrescription = new Map<string, any[]>();
      for (const item of itemsResult.rows) {
        const list = itemsByPrescription.get(item.prescription_id) || [];
        list.push(item);
        itemsByPrescription.set(item.prescription_id, list);
      }

      result.rows.forEach((prescription: any) => {
        prescription.items = itemsByPrescription.get(prescription.id) || [];
      });
    }

    res.json(success(result.rows));
  } catch (err: any) {
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to fetch prescriptions'));
  }
});

// Generate and download prescription PDF (DOCTOR only)
router.get('/:id/pdf', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const owned = await query(
      `SELECT id FROM prescriptions
       WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`,
      [id, userId]
    );
    if (owned.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
    }

    const result = await generatePrescriptionPdfFile(id);
    if (!result.success) {
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, result.error || 'Failed to generate PDF'));
    }

    res.json(success({ signedUrl: result.signedUrl }, 'PDF generated successfully'));
  } catch (err: any) {
    console.error('Error generating prescription PDF:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to generate prescription PDF'));
  }
});

// Get signed URL for existing prescription PDF (DOCTOR and PATIENT)
router.get('/:id/pdf-url', authenticate, authorize('DOCTOR', 'PATIENT'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    let prescription;
    if (role === 'PATIENT') {
      const result = await query(
        'SELECT pdf_url FROM prescriptions WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2) AND status = \'ISSUED\'',
        [id, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
      }
      prescription = result.rows[0];
    } else if (role === 'DOCTOR') {
      const result = await query(
        'SELECT pdf_url FROM prescriptions WHERE id = $1 AND doctor_id = (SELECT id FROM doctors WHERE user_id = $2)',
        [id, userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
      }
      prescription = result.rows[0];
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    if (!prescription.pdf_url) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'PDF not generated for this prescription'));
    }

    const signedUrlResult = await generateSignedPrescriptionUrl(prescription.pdf_url);

    if (!signedUrlResult.success) {
      return res.status(500).json(error(ErrorCodes.SERVER_ERROR, signedUrlResult.error || 'Failed to generate signed URL'));
    }

    res.json(success({ signedUrl: signedUrlResult.signedUrl }, 'Signed URL generated successfully'));
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    res.status(500).json(error(ErrorCodes.SERVER_ERROR, 'Failed to generate signed URL'));
  }
});

export default router;