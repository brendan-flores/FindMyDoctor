import { Router, Response } from 'express';
import { query } from '../database/connection';
import { success, error, ErrorCodes } from '../utils/response';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import { uploadPrescriptionPdf, generateSignedPrescriptionUrl } from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';
import { createNotification, NotificationTypes } from './notifications';
import { sendPushToUser } from '../services/pushService';

const router = Router();

// Create prescription
router.post('/', authenticate, authorize('DOCTOR'), async (req: AuthRequest, res: Response) => {
  try {
    const { visitId, items, notes } = req.body;

    if (!visitId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json(error(ErrorCodes.VALIDATION_ERROR, 'Visit ID and items are required'));
    }

    // Get visit details
    const visitResult = await query(
      'SELECT * FROM visits WHERE id = $1',
      [visitId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Visit not found'));
    }

    const visit = visitResult.rows[0];

    // Create prescription
    const prescriptionResult = await query(
      `INSERT INTO prescriptions (visit_id, patient_id, doctor_id, prescription_date, notes)
       VALUES ($1, $2, $3, CURRENT_DATE, $4)
       RETURNING *`,
      [visitId, visit.patient_id, visit.doctor_id, notes]
    );

    const prescriptionId = prescriptionResult.rows[0].id;

    // Add prescription items
    for (const item of items) {
      await query(
        `INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [prescriptionId, item.medicationName, item.dosage, item.frequency, item.duration, item.instructions]
      );
    }

    // Create notification for patient (best-effort, does not block prescription creation)
    const patientUserResult = await query(
      'SELECT user_id FROM patients WHERE id = $1',
      [visit.patient_id]
    );

    if (patientUserResult.rows.length > 0) {
      const patientUserId = patientUserResult.rows[0].user_id;
      try {
        await createNotification(
          patientUserId,
          NotificationTypes.PRESCRIPTION_AVAILABLE,
          'New Prescription Available',
          'Your doctor has issued a new prescription. View it in your prescriptions.',
          'prescription',
          prescriptionId
        );

        // Send push notification (best-effort, failures are logged and never block)
        await sendPushToUser(patientUserId, {
          title: 'New Prescription Available',
          body: 'Your doctor has issued a new prescription.',
          data: {
            type: 'PRESCRIPTION_AVAILABLE',
            prescriptionId: prescriptionId,
          },
        });
      } catch (notificationError) {
        console.error('Failed to create notification or send push for prescription:', notificationError);
        // Do not fail the prescription creation if notification fails
      }
    }

    res.status(201).json(success(prescriptionResult.rows[0], 'Prescription created successfully'));
  } catch (err: any) {
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

// Get patient's prescriptions
router.get('/patients/:id', authenticate, authorize('PATIENT', 'DOCTOR', 'SECRETARY'), async (req: AuthRequest, res: Response) => {
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
        WHERE p.patient_id = $1
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
    } else if (role === 'SECRETARY') {
      // Secretary can only access prescriptions for their assigned doctor's patients
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
               d.first_name as doctor_first_name, d.last_name as doctor_last_name
        FROM prescriptions p
        JOIN doctors d ON p.doctor_id = d.id
        WHERE p.patient_id = $1 AND p.doctor_id = $2
        ORDER BY p.prescription_date DESC
      `;
      params.push(assignedDoctorId);
    } else {
      return res.status(403).json(error(ErrorCodes.FORBIDDEN, 'Invalid role'));
    }

    const result = await query(queryText, params);

    // Include prescription items for secretary role (needed for medicine charge linking)
    if (role === 'SECRETARY' && result.rows.length > 0) {
      const prescriptionIds = result.rows.map((p: any) => p.id);
      const itemsResult = await query(
        'SELECT * FROM prescription_items WHERE prescription_id = ANY($1::uuid[])',
        [prescriptionIds]
      );

      // Group items by prescription_id
      const itemsByPrescription = new Map<string, any[]>();
      for (const item of itemsResult.rows) {
        const list = itemsByPrescription.get(item.prescription_id) || [];
        list.push(item);
        itemsByPrescription.set(item.prescription_id, list);
      }

      // Attach items to each prescription
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

    // Get prescription with full details
    const prescriptionResult = await query(
      `SELECT p.*, 
              pat.first_name as patient_first_name, pat.last_name as patient_last_name, pat.date_of_birth,
              d.first_name as doctor_first_name, d.last_name as doctor_last_name, d.practice_name, d.specialty,
              v.reason_for_visit, v.diagnosis
       FROM prescriptions p
       JOIN patients pat ON p.patient_id = pat.id
       JOIN doctors d ON p.doctor_id = d.id
       JOIN visits v ON p.visit_id = v.id
       WHERE p.id = $1 AND p.doctor_id = (SELECT id FROM doctors WHERE user_id = $2)`,
      [id, userId]
    );

    if (prescriptionResult.rows.length === 0) {
      return res.status(404).json(error(ErrorCodes.NOT_FOUND, 'Prescription not found'));
    }

    const prescription = prescriptionResult.rows[0];

    // Get prescription items
    const itemsResult = await query(
      'SELECT * FROM prescription_items WHERE prescription_id = $1',
      [id]
    );

    const items = itemsResult.rows;

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(chunks);
      const fileName = `prescription_${id}_${uuidv4()}.pdf`;

      // Upload to Supabase Storage
      const uploadResult = await uploadPrescriptionPdf(pdfBuffer, fileName);

      if (!uploadResult.success) {
        return res.status(500).json(error(ErrorCodes.SERVER_ERROR, uploadResult.error || 'Failed to upload PDF'));
      }

      // Update prescription with PDF path
      await query(
        'UPDATE prescriptions SET pdf_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [uploadResult.path, id]
      );

      // Generate signed URL
      const signedUrlResult = await generateSignedPrescriptionUrl(uploadResult.path || '');

      if (!signedUrlResult.success) {
        return res.status(500).json(error(ErrorCodes.SERVER_ERROR, signedUrlResult.error || 'Failed to generate signed URL'));
      }

      res.json(success({ signedUrl: signedUrlResult.signedUrl }, 'PDF generated successfully'));
    });

    // Build PDF content
    doc.fontSize(20).font('Helvetica-Bold').text('Medical Prescription', { align: 'center' });
    doc.moveDown();

    // Doctor and clinic header
    doc.fontSize(14).font('Helvetica-Bold').text(`${prescription.doctor_first_name} ${prescription.doctor_last_name}`);
    doc.fontSize(11).font('Helvetica').text(prescription.specialty || 'Doctor');
    if (prescription.practice_name) {
      doc.text(prescription.practice_name);
    }
    doc.moveDown();

    // Patient information
    doc.fontSize(12).font('Helvetica-Bold').text('Patient Information:');
    doc.fontSize(11).font('Helvetica').text(`Name: ${prescription.patient_first_name} ${prescription.patient_last_name}`);
    if (prescription.date_of_birth) {
      doc.text(`Date of Birth: ${new Date(prescription.date_of_birth).toLocaleDateString()}`);
    }
    doc.moveDown();

    // Visit information
    doc.fontSize(12).font('Helvetica-Bold').text('Visit Information:');
    doc.fontSize(11).font('Helvetica').text(`Date: ${new Date(prescription.prescription_date).toLocaleDateString()}`);
    if (prescription.reason_for_visit) {
      doc.text(`Reason for Visit: ${prescription.reason_for_visit}`);
    }
    if (prescription.diagnosis) {
      doc.text(`Diagnosis: ${prescription.diagnosis}`);
    }
    doc.moveDown();

    // Prescription items
    doc.fontSize(12).font('Helvetica-Bold').text('Medications:');
    doc.moveDown();

    items.forEach((item, index) => {
      doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${item.medication_name}`);
      doc.fontSize(10).font('Helvetica');
      if (item.dosage) doc.text(`   Dosage: ${item.dosage}`);
      if (item.frequency) doc.text(`   Frequency: ${item.frequency}`);
      if (item.duration) doc.text(`   Duration: ${item.duration}`);
      if (item.instructions) doc.text(`   Instructions: ${item.instructions}`);
      doc.moveDown();
    });

    // Notes
    if (prescription.notes) {
      doc.fontSize(12).font('Helvetica-Bold').text('Additional Notes:');
      doc.fontSize(11).font('Helvetica').text(prescription.notes);
    }

    doc.end();
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
        'SELECT pdf_url FROM prescriptions WHERE id = $1 AND patient_id = (SELECT id FROM patients WHERE user_id = $2)',
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