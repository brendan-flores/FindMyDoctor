import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';
import { uploadPrescriptionPdf, generateSignedPrescriptionUrl } from './storageService';

interface PdfResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

function calculateAge(dateOfBirth?: string | Date | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function formatSex(sex?: string | null): string | null {
  if (!sex || sex === 'NOT_SPECIFIED') return null;
  if (sex === 'MALE') return 'Male';
  if (sex === 'FEMALE') return 'Female';
  if (sex === 'OTHER') return 'Other';
  return sex;
}

/**
 * Render, upload and persist the PDF for an issued prescription.
 * The caller is expected to have already ensured the prescription belongs to
 * the requesting doctor. Returns a short-lived signed URL on success.
 */
export async function generatePrescriptionPdfFile(prescriptionId: string): Promise<PdfResult> {
  const prescriptionResult = await query(
    `SELECT p.*,
            pat.first_name AS patient_first_name, pat.middle_name AS patient_middle_name,
            pat.last_name AS patient_last_name, pat.date_of_birth, pat.sex,
            d.first_name AS doctor_first_name, d.middle_name AS doctor_middle_name,
            d.last_name AS doctor_last_name, d.practice_name, d.specialty, d.prc_license_number,
            v.reason_for_visit, v.diagnosis
     FROM prescriptions p
     JOIN patients pat ON p.patient_id = pat.id
     JOIN doctors d ON p.doctor_id = d.id
     JOIN visits v ON p.visit_id = v.id
     WHERE p.id = $1`,
    [prescriptionId]
  );

  if (prescriptionResult.rows.length === 0) {
    return { success: false, error: 'Prescription not found' };
  }

  const prescription = prescriptionResult.rows[0];

  const itemsResult = await query(
    'SELECT * FROM prescription_items WHERE prescription_id = $1 ORDER BY created_at ASC',
    [prescriptionId]
  );
  const items = itemsResult.rows;

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];

  const finished = new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });

  doc.fontSize(20).font('Helvetica-Bold').text('Medical Prescription', { align: 'center' });
  doc.moveDown();

  doc.fontSize(14).font('Helvetica-Bold').text(
    `Dr. ${[prescription.doctor_first_name, prescription.doctor_middle_name, prescription.doctor_last_name]
      .filter(Boolean)
      .join(' ')}`
  );
  doc.fontSize(11).font('Helvetica').text(prescription.specialty || 'Doctor');
  if (prescription.practice_name) {
    doc.text(prescription.practice_name);
  }
  if (prescription.prc_license_number) {
    doc.text(`PRC License No.: ${prescription.prc_license_number}`);
  }
  doc.moveDown();

  const patientName = [
    prescription.patient_first_name,
    prescription.patient_middle_name,
    prescription.patient_last_name,
  ]
    .filter(Boolean)
    .join(' ');
  const age = calculateAge(prescription.date_of_birth);
  const sex = formatSex(prescription.sex);

  doc.fontSize(12).font('Helvetica-Bold').text('Patient Information:');
  doc.fontSize(11).font('Helvetica').text(`Name: ${patientName}`);
  if (age !== null) {
    doc.text(`Age: ${age}`);
  }
  if (sex) {
    doc.text(`Sex: ${sex}`);
  }
  if (prescription.date_of_birth) {
    doc.text(`Date of Birth: ${new Date(prescription.date_of_birth).toLocaleDateString()}`);
  }
  doc.moveDown();

  doc.fontSize(12).font('Helvetica-Bold').text('Visit Information:');
  doc.fontSize(11).font('Helvetica').text(
    `Date: ${new Date(prescription.prescription_date).toLocaleDateString()}`
  );
  if (prescription.reason_for_visit) {
    doc.text(`Reason for Visit: ${prescription.reason_for_visit}`);
  }
  if (prescription.diagnosis) {
    doc.text(`Diagnosis: ${prescription.diagnosis}`);
  }
  doc.moveDown();

  doc.fontSize(12).font('Helvetica-Bold').text('Medications:');
  doc.moveDown();

  items.forEach((item: any, index: number) => {
    doc.fontSize(11).font('Helvetica-Bold').text(`${index + 1}. ${item.medication_name}`);
    doc.fontSize(10).font('Helvetica');
    if (item.dosage) doc.text(`   Dosage: ${item.dosage}`);
    if (item.frequency) doc.text(`   Frequency: ${item.frequency}`);
    if (item.duration) doc.text(`   Duration: ${item.duration}`);
    if (item.quantity !== null && item.quantity !== undefined) {
      doc.text(`   Quantity to dispense: ${item.quantity}`);
    }
    if (item.instructions) doc.text(`   Instructions: ${item.instructions}`);
    doc.moveDown();
  });

  if (prescription.notes) {
    doc.fontSize(12).font('Helvetica-Bold').text('Additional Notes:');
    doc.fontSize(11).font('Helvetica').text(prescription.notes);
  }

  doc.end();
  await finished;

  const pdfBuffer = Buffer.concat(chunks);
  const fileName = `prescription_${prescriptionId}_${uuidv4()}.pdf`;

  const uploadResult = await uploadPrescriptionPdf(pdfBuffer, fileName);
  if (!uploadResult.success) {
    return { success: false, error: uploadResult.error || 'Failed to upload PDF' };
  }

  await query(
    'UPDATE prescriptions SET pdf_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [uploadResult.path, prescriptionId]
  );

  const signedUrlResult = await generateSignedPrescriptionUrl(uploadResult.path || '');
  if (!signedUrlResult.success) {
    return { success: false, error: signedUrlResult.error || 'Failed to generate signed URL' };
  }

  return { success: true, signedUrl: signedUrlResult.signedUrl };
}
