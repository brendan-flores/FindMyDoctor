/**
 * Real PDFKit rendering smoke tests.
 *
 * These tests deliberately do NOT mock pdfkit. They verify that the layout
 * commands used by the service are accepted by the real renderer and produce a
 * valid PDF buffer, including embedding a real PNG signature.
 */

jest.mock('../database/connection', () => ({
  query: jest.fn(),
}));

jest.mock('./storageService', () => ({
  uploadPrescriptionPdf: jest.fn(),
  generateSignedPrescriptionUrl: jest.fn(),
  downloadDoctorSignature: jest.fn(),
}));

import { generatePrescriptionPdfFile } from './prescriptionPdfService';

const { query } = require('../database/connection');
const {
  uploadPrescriptionPdf,
  generateSignedPrescriptionUrl,
  downloadDoctorSignature,
} = require('./storageService');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const PRESCRIPTION = {
  id: '11111111-2222-3333-4444-555555555555',
  patient_id: 'patient-1',
  doctor_id: 'doctor-1',
  prescription_date: '2026-11-19',
  notes: 'Drink plenty of fluids. Follow up if symptoms persist.',
  status: 'ISSUED',
  pdf_url: null,
  replaces_prescription_id: null,
  patient_first_name: 'Maria',
  patient_middle_name: 'Santos',
  patient_last_name: 'Cruz',
  date_of_birth: '1990-05-14',
  sex: 'FEMALE',
  patient_address: '45 Sampaguita Avenue, Quezon City',
  doctor_first_name: 'Jane',
  doctor_middle_name: 'Ann',
  doctor_last_name: 'Smith',
  doctor_credentials: 'MD',
  practice_name: 'Rivera Medical Clinic',
  practice_address: '12 Mabini Street, Quezon City',
  practice_phone: '0281234567',
  practice_email: 'clinic@example.com',
  room_number: '204',
  specialty: 'Internal Medicine',
  prc_license_number: 'PRC-1234567',
  signature_url: 'doctor_signature_doctor-1.png',
  visit_date: '2026-11-19',
  reason_for_visit: 'Persistent cough',
  diagnosis: 'Acute bronchitis',
  appointment_date: '2026-11-19T09:00:00.000Z',
};

let uploadedBuffer: Buffer | null = null;

function installMocks(items: any[], prescription: Record<string, any> = PRESCRIPTION) {
  query.mockImplementation((sql: string) => {
    if (sql.includes('SELECT p.*')) return Promise.resolve({ rows: [prescription] });
    if (sql.includes('SELECT * FROM prescription_items')) return Promise.resolve({ rows: items });
    if (sql.includes('SELECT id, prescription_date FROM prescriptions WHERE id = $1')) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });

  uploadedBuffer = null;
  uploadPrescriptionPdf.mockImplementation((buffer: Buffer) => {
    uploadedBuffer = buffer;
    return Promise.resolve({ success: true, path: 'prescription_real.pdf' });
  });
  generateSignedPrescriptionUrl.mockResolvedValue({
    success: true,
    signedUrl: 'https://storage.example.com/real.pdf',
  });
}

const ITEMS = [
  {
    medication_name: 'Amoxicillin',
    dosage: '500 mg',
    frequency: 'Three times daily',
    duration: '7 days',
    instructions: 'Take after meals.',
    quantity: 21,
  },
];

describe('prescription PDF rendering with real PDFKit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('produces a valid single-page PDF without a signature', async () => {
    installMocks(ITEMS, { ...PRESCRIPTION, signature_url: null });
    downloadDoctorSignature.mockResolvedValue({ success: false });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(uploadedBuffer).not.toBeNull();
    const header = uploadedBuffer!.subarray(0, 5).toString('latin1');
    expect(header).toBe('%PDF-');
    expect(uploadedBuffer!.length).toBeGreaterThan(2000);

    const text = uploadedBuffer!.toString('latin1');
    const pageCount = (text.match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBe(1);
  }, 20000);

  it('embeds a real PNG signature without throwing', async () => {
    installMocks(ITEMS);
    downloadDoctorSignature.mockResolvedValue({ success: true, buffer: PNG_1X1 });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(downloadDoctorSignature).toHaveBeenCalledWith('doctor_signature_doctor-1.png');
    expect(uploadedBuffer!.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 20000);

  it('renders a multi-page PDF for a long medication list', async () => {
    const manyItems = Array.from({ length: 30 }, (_, index) => ({
      medication_name: `Medication ${index + 1}`,
      dosage: '500 mg',
      frequency: 'Three times daily',
      duration: '7 days',
      instructions: 'Take after meals with a full glass of water.',
      quantity: 21,
    }));
    installMocks(manyItems, { ...PRESCRIPTION, signature_url: null });
    downloadDoctorSignature.mockResolvedValue({ success: false });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const text = uploadedBuffer!.toString('latin1');
    const pageCount = (text.match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pageCount).toBeGreaterThan(1);
  }, 30000);
});
