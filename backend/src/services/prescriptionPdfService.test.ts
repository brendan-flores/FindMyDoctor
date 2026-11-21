/**
 * Tests for the prescription PDF generator's consolidated data load.
 *
 * `generatePrescriptionPdfFile` must fetch the prescription, its patient,
 * doctor, visit, replacement metadata, and medication items with one read
 * query. The PDF renderer is replaced by a recording fake so these tests can
 * assert what would be printed without depending on PDF byte output.
 */

jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
}));

jest.mock('../services/storageService', () => ({
  uploadPrescriptionPdf: jest.fn(),
  generateSignedPrescriptionUrl: jest.fn(),
  downloadDoctorSignature: jest.fn(),
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => '11111111-2222-4333-8444-555555555555'),
}));

// A minimal PDFKit stand-in that records every string written to the document.
// It implements only the surface the generator uses, so an unhandled PDFKit
// call fails the test instead of silently producing an incomplete document.
jest.mock('pdfkit', () => {
  class FakePDFDocument {
    static instances: any[] = [];

    options: any;
    y = 0;
    page = { margins: { bottom: 72 } };
    textLog: string[] = [];
    pageCount = 1;

    private dataListeners: Array<(chunk: Buffer) => void> = [];
    private endListeners: Array<() => void> = [];
    private errorListeners: Array<(error: unknown) => void> = [];

    constructor(options: any) {
      this.options = options;
      FakePDFDocument.instances.push(this);
    }

    on(event: string, callback: any) {
      if (event === 'data') this.dataListeners.push(callback);
      if (event === 'end') this.endListeners.push(callback);
      if (event === 'error') this.errorListeners.push(callback);
      return this;
    }

    font() {
      return this;
    }

    fontSize() {
      return this;
    }

    fillColor() {
      return this;
    }

    moveTo() {
      return this;
    }

    lineTo() {
      return this;
    }

    lineWidth() {
      return this;
    }

    strokeColor() {
      return this;
    }

    stroke() {
      return this;
    }

    addPage() {
      this.pageCount += 1;
      return this;
    }

    switchToPage() {
      return this;
    }

    bufferedPageRange() {
      return { start: 0, count: this.pageCount };
    }

    image() {
      return this;
    }

    widthOfString(text: unknown) {
      return String(text ?? '').length * 5;
    }

    text(text: unknown, x?: any, y?: any, options?: any) {
      this.textLog.push(String(text ?? ''));
      const width =
        x && typeof x === 'object' ? x.width : options ? options.width : undefined;
      const lineCount =
        typeof width === 'number' && width > 0
          ? Math.max(1, Math.ceil(this.widthOfString(text) / width))
          : 1;
      this.y += lineCount * 12;
      return this;
    }

    end() {
      const chunk = Buffer.from('%PDF-1.7 fake prescription');
      this.dataListeners.forEach((listener) => listener(chunk));
      this.endListeners.forEach((listener) => listener());
    }
  }

  return { __esModule: true, default: FakePDFDocument };
});

import { buildPrescriptionDownloadFileName, buildPrescriptionNumber } from './prescriptionFileName';

const { query } = require('../database/connection');
const { uploadPrescriptionPdf, generateSignedPrescriptionUrl } = require('../services/storageService');
const { generatePrescriptionPdfFile } = require('./prescriptionPdfService');

const FakePDFDocument = (require('pdfkit') as any).default;

const PRESCRIPTION_ID = 'prescription-1';
const ORIGINAL_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ORIGINAL_DATE = '2026-10-20';

const BASE_ROW: Record<string, any> = {
  id: PRESCRIPTION_ID,
  visit_id: 'visit-1',
  patient_id: 'patient-1',
  doctor_id: 'doctor-1',
  prescription_date: '2026-11-17',
  pdf_url: null,
  notes: 'Take all medication with food.',
  created_at: '2026-11-17T09:00:00.000Z',
  updated_at: '2026-11-17T09:00:00.000Z',
  status: 'ISSUED',
  voided_at: null,
  void_reason: null,
  voided_by: null,
  replaces_prescription_id: null,
  patient_first_name: 'Beavz',
  patient_middle_name: 'Santos',
  patient_last_name: 'Flores',
  date_of_birth: '1990-05-04',
  sex: 'MALE',
  patient_address: '123 Mabini St, Manila',
  doctor_first_name: 'Maria',
  doctor_middle_name: 'Lopez',
  doctor_last_name: 'Santos',
  doctor_credentials: 'MD',
  practice_name: 'Santos Clinic',
  practice_address: '45 Rizal Ave, Manila',
  practice_phone: '+63 2 1234 5678',
  practice_email: 'clinic@example.com',
  room_number: '203',
  specialty: 'Internal Medicine',
  prc_license_number: '1234567',
  signature_url: null,
  visit_date: '2026-11-17T08:30:00.000Z',
  reason_for_visit: 'Persistent cough',
  diagnosis: 'Acute bronchitis',
  appointment_date: '2026-11-17',
  is_superseded: false,
  replaces_original_id: null,
  replaces_original_date: null,
  items: [],
};

const ITEMS = [
  {
    id: 'item-1',
    prescription_id: PRESCRIPTION_ID,
    medication_name: 'Aspirin',
    dosage: '500 mg',
    frequency: 'Once daily',
    duration: '5 days',
    instructions: 'After meals',
    quantity: 10,
    created_at: '2026-11-17T09:01:00.000Z',
  },
  {
    id: 'item-2',
    prescription_id: PRESCRIPTION_ID,
    medication_name: 'Metformin',
    dosage: '250 mg',
    frequency: 'Twice daily',
    duration: '7 days',
    instructions: 'With water',
    quantity: 14,
    created_at: '2026-11-17T09:02:00.000Z',
  },
  {
    id: 'item-3',
    prescription_id: PRESCRIPTION_ID,
    medication_name: 'Ibuprofen',
    dosage: '200 mg',
    frequency: 'As needed',
    duration: '3 days',
    instructions: null,
    quantity: 6,
    created_at: '2026-11-17T09:03:00.000Z',
  },
];

function mockPrescriptionRow(overrides: Record<string, any> = {}) {
  const row = { ...BASE_ROW, ...overrides };
  query.mockImplementation(async (sql: string) => {
    if (/^\s*SELECT/i.test(sql)) {
      return { rows: [row], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  return row;
}

function lastDocument(): any {
  const document = FakePDFDocument.instances[FakePDFDocument.instances.length - 1];
  expect(document).toBeDefined();
  return document;
}

function writtenText(): string[] {
  return lastDocument().textLog;
}

function joinedText(): string {
  return writtenText().join(' ');
}

describe('generatePrescriptionPdfFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FakePDFDocument.instances.length = 0;

    uploadPrescriptionPdf.mockResolvedValue({
      success: true,
      path: `prescriptions/${PRESCRIPTION_ID}_v5_11111111-2222-4333-8444-555555555555.pdf`,
    });
    generateSignedPrescriptionUrl.mockResolvedValue({
      success: true,
      signedUrl: 'https://storage.example/signed-prescription.pdf',
    });
  });

  it('loads the prescription with a single read query', async () => {
    mockPrescriptionRow({ items: ITEMS });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(result.success).toBe(true);

    const sqlCalls = query.mock.calls.map((call: any[]) => String(call[0]));
    const readQueries = sqlCalls.filter((sql: string) => /^\s*SELECT/i.test(sql));

    expect(readQueries).toHaveLength(1);
    expect(readQueries[0]).toContain('json_agg(i ORDER BY i.created_at ASC)');
    expect(readQueries[0]).toContain(
      'LEFT JOIN prescriptions orig ON orig.id = p.replaces_prescription_id'
    );
    expect(readQueries[0]).toContain('orig.prescription_date AS replaces_original_date');
    expect(readQueries[0]).toContain('is_superseded');
    expect(readQueries[0]).toContain('WHERE p.id = $1');

    // One consolidated read plus the existing pdf_url update.
    expect(sqlCalls).toHaveLength(2);
    expect(sqlCalls[1]).toMatch(/^\s*UPDATE prescriptions SET pdf_url/);
  });

  it('renders prescription items returned as an array', async () => {
    mockPrescriptionRow({ items: ITEMS });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(result.success).toBe(true);
    const text = writtenText();
    expect(text).toContain('Aspirin');
    expect(text).toContain('Metformin');
    expect(text).toContain('Ibuprofen');
    expect(text).toContain('500 mg');
    expect(text).toContain('After meals');
  });

  it('parses items returned as a JSON string', async () => {
    mockPrescriptionRow({ items: JSON.stringify(ITEMS) });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(result.success).toBe(true);
    expect(writtenText()).toContain('Metformin');
  });

  it('preserves prescription item ordering', async () => {
    mockPrescriptionRow({ items: ITEMS });

    await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    const text = writtenText();
    const aspirin = text.indexOf('Aspirin');
    const metformin = text.indexOf('Metformin');
    const ibuprofen = text.indexOf('Ibuprofen');

    expect(aspirin).toBeGreaterThanOrEqual(0);
    expect(metformin).toBeGreaterThan(aspirin);
    expect(ibuprofen).toBeGreaterThan(metformin);
  });

  it('handles empty prescription items safely', async () => {
    mockPrescriptionRow({ items: [] });

    const emptyArrayResult = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(emptyArrayResult.success).toBe(true);
    expect(writtenText()).toContain('No medications recorded for this prescription.');

    FakePDFDocument.instances.length = 0;
    mockPrescriptionRow({ items: null });

    const nullResult = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(nullResult.success).toBe(true);
    expect(writtenText()).toContain('No medications recorded for this prescription.');
  });

  it('maps the original prescription date for replacement prescriptions', async () => {
    mockPrescriptionRow({
      items: ITEMS,
      replaces_prescription_id: ORIGINAL_ID,
      replaces_original_id: ORIGINAL_ID,
      replaces_original_date: ORIGINAL_DATE,
      is_superseded: false,
    });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION_ID);
    expect(result.success).toBe(true);

    const originalNumber = buildPrescriptionNumber(ORIGINAL_ID, ORIGINAL_DATE);
    const replacementSentence = joinedText();

    expect(replacementSentence).toContain(`Replacement for prescription ${originalNumber}`);
    expect(replacementSentence).toContain('This prescription supersedes it');
    expect(replacementSentence).toContain('Oct 20, 2026');

    const expectedTitle = buildPrescriptionDownloadFileName({
      prescriptionId: PRESCRIPTION_ID,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: 'Flores',
      replacesPrescriptionId: ORIGINAL_ID,
      replacesPrescriptionDate: ORIGINAL_DATE,
      superseded: false,
    });

    expect(lastDocument().options.info.Title).toBe(expectedTitle);
    expect(expectedTitle).toContain(`_replaces-${originalNumber.slice(-8)}`);
    expect(expectedTitle).not.toContain('_SUPERSEDED');
  });

  it('supports normal prescriptions without a replacement', async () => {
    mockPrescriptionRow({ items: ITEMS });

    await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(joinedText()).not.toContain('Replacement for prescription');
    expect(lastDocument().options.info.Title).not.toContain('_replaces-');
  });

  it('keeps the existing PDF output, upload path, and signed URL', async () => {
    mockPrescriptionRow({ items: ITEMS });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(result).toEqual({
      success: true,
      signedUrl: 'https://storage.example/signed-prescription.pdf',
      filePath: `prescriptions/${PRESCRIPTION_ID}_v5_11111111-2222-4333-8444-555555555555.pdf`,
    });

    const text = joinedText();
    expect(text).toContain('MEDICAL PRESCRIPTION');
    expect(text).toContain('Beavz Santos Flores');
    expect(text).toContain('Dr. Maria Lopez Santos, MD');
    expect(text).toContain('Santos Clinic');
    expect(text).toContain('PRC License No.: 1234567');
    expect(text).toContain('Nov 17, 2026');
    expect(text).toContain('Acute bronchitis');
    expect(text).toContain('Persistent cough');
    expect(text).toContain('Take all medication with food.');

    const expectedFileName = `prescription_${PRESCRIPTION_ID}_v5_11111111-2222-4333-8444-555555555555.pdf`;
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    const [pdfBuffer, fileName] = uploadPrescriptionPdf.mock.calls[0];
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    expect(fileName).toBe(expectedFileName);
    expect(fileName).toContain('_v5_');

    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith(
      `prescriptions/${PRESCRIPTION_ID}_v5_11111111-2222-4333-8444-555555555555.pdf`
    );

    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toMatch(/^\s*UPDATE prescriptions SET pdf_url/);
    expect(updateCall[1]).toEqual([
      `prescriptions/${PRESCRIPTION_ID}_v5_11111111-2222-4333-8444-555555555555.pdf`,
      PRESCRIPTION_ID,
    ]);
  });

  it('returns not-found without generating, uploading, or updating', async () => {
    query.mockImplementation(async (sql: string) => {
      if (/^\s*SELECT/i.test(sql)) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    });

    const result = await generatePrescriptionPdfFile(PRESCRIPTION_ID);

    expect(result).toEqual({ success: false, error: 'Prescription not found' });
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
    expect(generateSignedPrescriptionUrl).not.toHaveBeenCalled();
    expect(query.mock.calls).toHaveLength(1);
  });
});
