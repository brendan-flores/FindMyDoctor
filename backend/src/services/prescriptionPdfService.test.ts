/**
 * Tests for prescription PDF rendering.
 *
 * PDFKit is replaced with an in-memory recorder so the tests can assert on the
 * content that would be printed: the real uploaded signature image is embedded,
 * physician details remain below the signature line when no image is present,
 * and generation fails instead of omitting a stored signature.
 */

jest.mock('../database/connection', () => ({
  query: jest.fn(),
}));

jest.mock('./storageService', () => ({
  uploadPrescriptionPdf: jest.fn(),
  generateSignedPrescriptionUrl: jest.fn(),
  downloadDoctorSignature: jest.fn(),
}));

jest.mock('pdfkit', () => {
  class FakePdfDocument {
    options: any;
    y = 0;
    pages = 1;
    ended = false;
    page = { margins: { bottom: 72 } };
    private currentFontSize = 10;
    texts: Array<{ text: string; x?: number; y?: number; options?: any }> = [];
    images: Array<{ buffer: Buffer; x?: number; y?: number; options?: any }> = [];
    shapeCalls = { rect: 0, roundedRect: 0, fillAndStroke: 0 };
    private handlers: Record<string, Array<(...args: any[]) => void>> = {};

    constructor(options?: any) {
      this.options = options;
    }

    on(event: string, callback: (...args: any[]) => void) {
      (this.handlers[event] ||= []).push(callback);
      return this;
    }

    emit(event: string, ...args: any[]) {
      for (const callback of this.handlers[event] || []) {
        callback(...args);
      }
    }

    font() { return this; }
    fontSize(size?: number) {
      if (typeof size === 'number') this.currentFontSize = size;
      return this;
    }
    fillColor() { return this; }
    rect() { this.shapeCalls.rect += 1; return this; }
    roundedRect() { this.shapeCalls.roundedRect += 1; return this; }
    fill() { return this; }
    fillAndStroke() { this.shapeCalls.fillAndStroke += 1; return this; }
    strokeColor() { return this; }
    stroke() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    lineWidth() { return this; }
    switchToPage() { return this; }

    addPage() {
      this.pages += 1;
      return this;
    }

    bufferedPageRange() {
      return { start: 0, count: this.pages };
    }

    heightOfString(text: string) {
      const length = String(text || '').length;
      return Math.max(12, Math.ceil(length / 55) * 11);
    }

    widthOfString(text: string) {
      return String(text || '').length * this.currentFontSize * 0.5;
    }

    text(text: string, x?: number, y?: number, options?: any) {
      this.texts.push({ text: String(text), x, y, options });
      if (typeof y === 'number') {
        this.y = y;
      }
      this.y += 12;
      return this;
    }

    image(buffer: Buffer, x?: number, y?: number, options?: any) {
      if (PDF_DOCUMENT_MOCK.__failImage) {
        throw new Error('Unsupported image');
      }
      if (buffer?.toString() === 'INVALID-IMAGE') {
        throw new Error('Unsupported image');
      }
      this.images.push({ buffer, x, y, options });
      return this;
    }

    end() {
      this.ended = true;
      this.emit('data', Buffer.from('%PDF-1.7 fake prescription pdf'));
      this.emit('end');
    }
  }

  const instances: FakePdfDocument[] = [];
  const ctor: any = jest.fn().mockImplementation((options: any) => {
    const doc = new FakePdfDocument(options);
    instances.push(doc);
    return doc;
  });
  ctor.__instances = instances;
  ctor.__failImage = false;
  return ctor;
});

import {
  buildPrescriptionNumber,
  buildPrescriptionDownloadFileName,
  ensurePrescriptionPdf,
  generatePrescriptionPdfFile,
  _clearInFlightUpgrades,
} from './prescriptionPdfService';
import sharp from 'sharp';
import { isValidPrescriptionDownloadFileName } from './prescriptionFileName';

const { query } = require('../database/connection');
const {
  uploadPrescriptionPdf,
  generateSignedPrescriptionUrl,
  downloadDoctorSignature,
} = require('./storageService');

const PDF_DOCUMENT_MOCK = require('pdfkit');

const BASE_PRESCRIPTION: Record<string, any> = {
  id: '11111111-2222-3333-4444-555555555555',
  patient_id: 'patient-1',
  doctor_id: 'doctor-1',
  prescription_date: '2026-11-19',
  notes: 'Drink plenty of fluids.',
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

const BASE_ITEMS = [
  {
    id: 'item-1',
    medication_name: 'Amoxicillin',
    dosage: '500mg',
    frequency: 'Three times daily',
    duration: '7 days',
    instructions: 'Take after meals.',
    quantity: 21,
  },
  {
    id: 'item-2',
    medication_name: 'Paracetamol',
    dosage: '500mg',
    frequency: 'Every 6 hours as needed',
    duration: '3 days',
    instructions: 'Do not exceed 4 doses in 24 hours.',
    quantity: 12,
  },
];

let PNG_SIGNATURE: Buffer;

beforeAll(async () => {
  PNG_SIGNATURE = await sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).png().toBuffer();
});

function installQueryMock(options: {
  prescription?: Record<string, any>;
  items?: any[];
  replaced?: Record<string, any> | null;
  updateFails?: boolean;
  storedPdfUrl?: string | null;
} = {}) {
  const prescription = options.prescription ?? BASE_PRESCRIPTION;
  const items = options.items ?? BASE_ITEMS;

  query.mockImplementation((sql: string) => {
    if (sql.includes('p.updated_at AS pdf_updated_at')) {
      return Promise.resolve({
        rows: options.storedPdfUrl === undefined
          ? []
          : [{
              pdf_url: options.storedPdfUrl,
              pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
              signature_url: prescription.signature_url,
              doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
            }],
      });
    }
    if (sql.startsWith('SELECT pdf_url FROM prescriptions WHERE id = $1')) {
      return Promise.resolve({
        rows: options.storedPdfUrl === undefined ? [] : [{ pdf_url: options.storedPdfUrl }],
      });
    }
    if (sql.includes('SELECT p.*')) {
      return Promise.resolve({ rows: [prescription] });
    }
    if (sql.includes('SELECT * FROM prescription_items')) {
      return Promise.resolve({ rows: items });
    }
    if (sql.includes('SELECT id, prescription_date FROM prescriptions WHERE id = $1')) {
      return Promise.resolve({ rows: options.replaced ? [options.replaced] : [] });
    }
    if (sql.startsWith('UPDATE prescriptions')) {
      if (options.updateFails) {
        return Promise.reject(new Error('database unavailable'));
      }
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

function installStorageMocks(options: {
  signatureBuffer?: Buffer | null;
  downloadFails?: boolean;
  uploadFails?: boolean;
  signedUrlFails?: boolean;
} = {}) {
  if (options.downloadFails) {
    downloadDoctorSignature.mockResolvedValue({ success: false, error: 'object not found' });
  } else if (options.signatureBuffer === null) {
    downloadDoctorSignature.mockResolvedValue({ success: false, error: 'missing' });
  } else {
    downloadDoctorSignature.mockResolvedValue({
      success: true,
      buffer: options.signatureBuffer ?? PNG_SIGNATURE,
    });
  }

  uploadPrescriptionPdf.mockResolvedValue(
    options.uploadFails
      ? { success: false, error: 'upload failed' }
      : { success: true, path: 'prescription_1.pdf' }
  );
  generateSignedPrescriptionUrl.mockResolvedValue(
    options.signedUrlFails
      ? { success: false, error: 'signed url failed' }
      : { success: true, signedUrl: 'https://storage.example.com/rx.pdf' }
  );
}

function currentDocument(): any {
  const instances = PDF_DOCUMENT_MOCK.__instances as any[];
  return instances[instances.length - 1];
}

function printedText(): string {
  return currentDocument()
    .texts.map((entry: any) => entry.text)
    .join('\n');
}

describe('buildPrescriptionNumber', () => {
  it('derives a stable, human-readable number from the id and issue date', () => {
    const id = 'abcdef12-3456-7890-abcd-ef1234567890';

    expect(buildPrescriptionNumber(id, '2026-11-19')).toBe('RX-20261119-ABCDEF12');
    expect(buildPrescriptionNumber(id, '2026-11-19')).toBe(
      buildPrescriptionNumber(id, '2026-11-19')
    );
  });

  it('falls back to a placeholder when the id is missing', () => {
    expect(buildPrescriptionNumber('', '2026-01-02')).toBe('RX-20260102-UNKNOWN');
  });
});

describe('buildPrescriptionDownloadFileName', () => {
  const prescriptionId = '006b2828-de19-4b37-b611-58b47d53d3a3';
  const replacedPrescriptionId = '41a6b551-aaaa-bbbb-cccc-dddddddddddd';

  it('builds the documented SURNAME_Firstname_RX-YYYYMMDD-XXXXXXXX.pdf name', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: 'Flores',
    })).toBe('FLORES_Beavz_RX-20261117-006B2828.pdf');
  });

  it('hyphenates multi-part names and folds ñ and apostrophes to plain letters', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Juan Carlos',
      patientLastName: 'Peña Dela Cruz, Jr.',
    })).toBe('PENA-DELA-CRUZ-JR_Juan-Carlos_RX-20261117-006B2828.pdf');

    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: "Anne-Marie O'Neil",
      patientLastName: "O'Brien",
    })).toBe('OBRIEN_Anne-Marie-Oneil_RX-20261117-006B2828.pdf');
  });

  it('title-cases the first name and uppercases the surname', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'jUAN',
      patientLastName: 'dela_cruz',
    })).toBe('DELA-CRUZ_Juan_RX-20261117-006B2828.pdf');
  });

  it('falls back to the name-free prescription number when either name part is missing or invalid', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: '!!!',
      patientLastName: 'Flores',
    })).toBe('RX-20261117-006B2828.pdf');

    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: null,
    })).toBe('RX-20261117-006B2828.pdf');

    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
    })).toBe('RX-20261117-006B2828.pdf');

    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: '!!!',
      patientLastName: 'Flores',
      replacesPrescriptionId: replacedPrescriptionId,
      replacesPrescriptionDate: '2026-11-10',
      superseded: true,
    })).toBe('RX-20261117-006B2828.pdf');
  });

  it('marks a replacement with the original prescription number', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: 'Flores',
      replacesPrescriptionId: replacedPrescriptionId,
      replacesPrescriptionDate: '2026-11-10',
    })).toBe(
      'FLORES_Beavz_RX-20261117-006B2828_replaces-41A6B551.pdf'
    );
  });

  it('marks a replaced prescription as superseded', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId: replacedPrescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: 'Flores',
      superseded: true,
    })).toBe('FLORES_Beavz_RX-20261117-41A6B551_SUPERSEDED.pdf');
  });

  it('keeps replacement and superseded markers together', () => {
    expect(buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: 'Flores',
      replacesPrescriptionId: replacedPrescriptionId,
      replacesPrescriptionDate: '2026-11-10',
      superseded: true,
    })).toBe(
      'FLORES_Beavz_RX-20261117-006B2828_replaces-41A6B551_SUPERSEDED.pdf'
    );
  });

  it('produces only allowed characters and never includes other patient data', () => {
    const fileName = buildPrescriptionDownloadFileName({
      prescriptionId,
      prescriptionDate: '2026-11-17',
      patientFirstName: 'Beavz',
      patientLastName: 'Flores',
    });

    expect(fileName).toMatch(/^[A-Za-z0-9_-]+\.pdf$/);
    expect(fileName).not.toContain('1990');
    expect(fileName).not.toContain('Flu');
    expect(fileName).not.toContain('Amoxicillin');
  });
});

describe('isValidPrescriptionDownloadFileName', () => {
  it('accepts the clinic, replacement, superseded, and fallback names', () => {
    expect(isValidPrescriptionDownloadFileName('FLORES_Beavz_RX-20261117-006B2828.pdf')).toBe(true);
    expect(isValidPrescriptionDownloadFileName(
      'FLORES_Beavz_RX-20261117-006B2828_replaces-41A6B551.pdf'
    )).toBe(true);
    expect(isValidPrescriptionDownloadFileName(
      'FLORES_Beavz_RX-20261117-41A6B551_SUPERSEDED.pdf'
    )).toBe(true);
    expect(isValidPrescriptionDownloadFileName('RX-20261117-006B2828.pdf')).toBe(true);
  });

  it('rejects name-free RX names that lack the date/number layout and storage object names', () => {
    expect(isValidPrescriptionDownloadFileName('RX-abc123.pdf')).toBe(false);
    expect(isValidPrescriptionDownloadFileName('FLORES_Beavz.pdf')).toBe(false);
    expect(isValidPrescriptionDownloadFileName(
      'prescription_006b2828-de19-4b37-b611-58b47d53d3a3_v5_12345678-1234-1234-1234-123456789abc.pdf'
    )).toBe(false);
  });
});

describe('generatePrescriptionPdfFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PDF_DOCUMENT_MOCK.__instances.length = 0;
    PDF_DOCUMENT_MOCK.__failImage = false;
  });

  it('embeds the actual stored signature and prints the prescription content', async () => {
    installQueryMock();
    const signature = PNG_SIGNATURE;
    installStorageMocks({ signatureBuffer: signature });

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(result.signedUrl).toBe('https://storage.example.com/rx.pdf');

    expect(downloadDoctorSignature).toHaveBeenCalledWith('doctor_signature_doctor-1.png');

    const doc = currentDocument();
    expect(doc.images).toHaveLength(1);
    expect(doc.shapeCalls).toEqual({ rect: 0, roundedRect: 0, fillAndStroke: 0 });
    expect(doc.images[0].buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    // The signature is fitted into the available box so it keeps its
    // original proportions instead of being stretched.
    expect(doc.images[0].options.fit).toEqual([185, 44]);
    expect(doc.images[0].options.width).toBeUndefined();
    expect(doc.images[0].options.height).toBeUndefined();

    const text = printedText();
    expect(text).toContain('MEDICAL PRESCRIPTION');
    expect(text).toContain('PRESCRIPTION NO.');
    expect(text).toContain('DATE ISSUED');
    expect(text).not.toContain('SIGNATURE');
    expect(text).not.toContain("Physician's Signature");
    expect(text).toContain('PRESCRIBING PHYSICIAN');
    expect(text).toContain('PATIENT INFORMATION');
    expect(text).toContain('CLINICAL INFORMATION');
    expect(text).toContain('ADDITIONAL INSTRUCTIONS');
    expect(text).toContain('MEDICATIONS');
    expect(text).toContain('No.');
    expect(text).toContain('Medicine');
    expect(text).toContain('Dosage');
    expect(text).toContain('Frequency');
    expect(text).toContain('Duration');
    expect(text).toContain('Quantity');
    expect(text).toContain('Instructions');
    expect(text).toContain('Amoxicillin');
    expect(text).toContain('Paracetamol');
    expect(text).toContain('Take after meals.');
    expect(text).toContain('45 Sampaguita Avenue, Quezon City');
    expect(text).toContain('Page 1 of 1');
    expect(text).toContain('Rivera Medical Clinic');
    expect(text).toContain('Dr. Jane Ann Smith, MD');
    expect(text).toContain('PRC License No.: PRC-1234567');
    expect(text).toContain('Acute bronchitis');
    expect(text).toContain('Persistent cough');
    expect(text).toContain('RX-20261119-11111111');
    const textEntries = doc.texts.map((entry: any) => entry.text);
    const signatureNameIndex = textEntries.lastIndexOf('Dr. Jane Ann Smith, MD');
    expect(textEntries.slice(signatureNameIndex, signatureNameIndex + 3)).toEqual([
      'Dr. Jane Ann Smith, MD',
      'Internal Medicine',
      'PRC License No.: PRC-1234567',
    ]);

    // The PDF is uploaded once and the stored path is persisted.
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    const [, fileName] = uploadPrescriptionPdf.mock.calls[0];
    expect(fileName).toContain(BASE_PRESCRIPTION.id);
    const updateCall = query.mock.calls.find((call: any[]) =>
      call[0].startsWith('UPDATE prescriptions')
    );
    expect(updateCall![1][0]).toBe('prescription_1.pdf');
  });

  it('prints physician details beneath the line when no signature image exists', async () => {
    installQueryMock({
      prescription: { ...BASE_PRESCRIPTION, signature_url: null },
    });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(downloadDoctorSignature).not.toHaveBeenCalled();
    expect(currentDocument().images).toHaveLength(0);
    expect(printedText()).not.toContain('SIGNATURE');
    expect(printedText()).not.toContain("Physician's Signature");
    const textEntries = currentDocument().texts.map((entry: any) => entry.text);
    const signatureNameIndex = textEntries.lastIndexOf('Dr. Jane Ann Smith, MD');
    expect(textEntries.slice(signatureNameIndex, signatureNameIndex + 3)).toEqual([
      'Dr. Jane Ann Smith, MD',
      'Internal Medicine',
      'PRC License No.: PRC-1234567',
    ]);
    expect(printedText()).toContain('Dr. Jane Ann Smith, MD');
    expect(printedText()).toContain('Internal Medicine');
    expect(printedText()).toContain('PRC License No.: PRC-1234567');
  });

  it('fails instead of generating a PDF when the stored signature cannot be downloaded', async () => {
    installQueryMock();
    installStorageMocks({ downloadFails: true });

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('signature could not be retrieved');
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
    expect(query.mock.calls.some((call: any[]) => call[0].startsWith('UPDATE prescriptions'))).toBe(false);
  });

  it('fails instead of generating a PDF when the signature cannot be embedded', async () => {
    installQueryMock();
    installStorageMocks({ signatureBuffer: PNG_SIGNATURE });
    PDF_DOCUMENT_MOCK.__failImage = true;

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('could not be embedded');
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
  });

  it('renders multiple medications, quantities, and long instructions', async () => {
    const longInstructions = `Take with food. ${'Continue until the full course is finished. '.repeat(20)}`;
    installQueryMock({
      items: [
        ...BASE_ITEMS,
        {
          id: 'item-3',
          medication_name: 'Cetirizine',
          dosage: '10mg',
          frequency: 'Once daily at bedtime',
          duration: '10 days',
          instructions: longInstructions,
          quantity: 10,
        },
      ],
    });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const text = printedText();
    expect(text).toContain('Cetirizine');
    expect(text).toContain('Quantity');
    expect(text).toContain('10');
    expect(text.replace(/\s+/g, ' ')).toContain('Continue until the full course is finished.');
  });

  it('renders a single medication and omits medication fields that have no value', async () => {
    installQueryMock({
      items: [
        {
          id: 'item-1',
          medication_name: 'Paracetamol',
          dosage: '500 mg',
          frequency: null,
          duration: null,
          instructions: null,
          quantity: null,
        },
      ],
    });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const text = printedText();
    expect(text).toContain('Paracetamol');
    expect(text).toContain('500 mg');
    expect(text).toContain('Dosage');
    // Empty values leave their table cells blank; they do not get placeholders.
    const textEntries = currentDocument().texts.map((entry: any) => entry.text);
    expect(textEntries.filter((value: string) => value === 'Frequency')).toHaveLength(1);
    expect(textEntries.filter((value: string) => value === 'Duration')).toHaveLength(1);
    expect(textEntries.filter((value: string) => value === 'Quantity')).toHaveLength(1);
    expect(text).not.toContain('null');
  });

  it('omits unavailable clinic and patient fields without inventing values', async () => {
    installQueryMock({
      prescription: {
        ...BASE_PRESCRIPTION,
        practice_name: null,
        practice_address: '',
        practice_phone: null,
        practice_email: null,
        room_number: null,
        specialty: null,
        prc_license_number: null,
        patient_address: null,
      },
    });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const text = printedText();
    expect(text).toContain('Dr. Jane Ann Smith, MD');
    expect(text).not.toContain('Rivera Medical Clinic');
    expect(text).not.toContain('12 Mabini Street');
    expect(text).not.toContain('clinic@example.com');
    expect(text).not.toContain('PRC License No.:');
    expect(text).not.toContain('Address:');
    expect(text).toContain('Page 1 of 1');
  });

  it('creates additional pages with repeated header and correct page numbering', async () => {
    const manyItems = Array.from({ length: 24 }, (_, index) => ({
      id: `item-${index + 1}`,
      medication_name: `Medication ${index + 1}`,
      dosage: '500 mg',
      frequency: 'Three times daily',
      duration: '7 days',
      instructions: 'Take after meals.',
      quantity: 21,
    }));
    installQueryMock({ items: manyItems });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const doc = currentDocument();
    expect(doc.pages).toBeGreaterThan(1);
    const text = printedText();
    expect(text).toContain('Continued');
    expect(text).toContain(`Page 1 of ${doc.pages}`);
    expect(text).toContain(`Page ${doc.pages} of ${doc.pages}`);
    expect(text).toContain('Medication 24');
  });

  it('keeps long additional instructions and page numbering intact', async () => {
    const longNotes = `${'Follow up with the clinic if symptoms do not improve. '.repeat(80)}Final note.`;
    installQueryMock({
      prescription: { ...BASE_PRESCRIPTION, notes: longNotes },
    });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const doc = currentDocument();
    expect(doc.pages).toBeGreaterThan(1);
    const text = printedText();
    expect(text).toContain('ADDITIONAL INSTRUCTIONS');
    expect(text).toContain('Follow up with the clinic if symptoms do not improve.');
    expect(text).toContain('Final note.');
    expect(text).toContain(`Page ${doc.pages} of ${doc.pages}`);
  });

  it('sets the print/PDF title metadata to the shared filename', async () => {
    installQueryMock();
    installStorageMocks();

    await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(currentDocument().options.info.Title).toBe(
      'CRUZ_Maria_RX-20261119-11111111.pdf'
    );
  });

  it('sets replacement and superseded markers in the print/PDF title metadata', async () => {
    installQueryMock({
      prescription: {
        ...BASE_PRESCRIPTION,
        replaces_prescription_id: '41a6b551-aaaa-bbbb-cccc-dddddddddddd',
      },
      replaced: {
        id: '41a6b551-aaaa-bbbb-cccc-dddddddddddd',
        prescription_date: '2026-11-10',
      },
    });
    installStorageMocks();

    await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);
    expect(currentDocument().options.info.Title).toBe(
      'CRUZ_Maria_RX-20261119-11111111_replaces-41A6B551.pdf'
    );

    PDF_DOCUMENT_MOCK.__instances.length = 0;
    installQueryMock({
      prescription: { ...BASE_PRESCRIPTION, status: 'VOIDED', is_superseded: true },
    });
    installStorageMocks();

    await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);
    expect(currentDocument().options.info.Title).toBe(
      'CRUZ_Maria_RX-20261119-11111111_SUPERSEDED.pdf'
    );
  });

  it('notes when the prescription replaces an earlier one', async () => {
    installQueryMock({
      prescription: {
        ...BASE_PRESCRIPTION,
        replaces_prescription_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      },
      replaced: {
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        prescription_date: '2026-11-10',
      },
    });
    installStorageMocks();

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    const doc = currentDocument();
    const textEntries = doc.texts.map((entry: any) => entry.text);
    const prescriptionNumberIndex = textEntries.findIndex((value: string) => value.startsWith('RX-'));
    expect(textEntries[prescriptionNumberIndex + 1]).toContain(
      'Replacement for prescription RX-20261110-AAAAAAAA'
    );
    expect(textEntries.indexOf('DATE ISSUED')).toBeGreaterThan(prescriptionNumberIndex + 1);
    expect(doc.shapeCalls).toEqual({ rect: 0, roundedRect: 0, fillAndStroke: 0 });
  });

  it('fails when the PDF cannot be uploaded', async () => {
    installQueryMock();
    installStorageMocks({ uploadFails: true });

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe('upload failed');
  });

  it('fails when a signed URL cannot be generated', async () => {
    installQueryMock();
    installStorageMocks({ signedUrlFails: true });

    const result = await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe('signed url failed');
  });

  it('fails when the prescription does not exist', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await generatePrescriptionPdfFile('missing-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Prescription not found');
    expect(PDF_DOCUMENT_MOCK.__instances).toHaveLength(0);
  });

  it('names the stored artifact with the current layout version', async () => {
    installQueryMock();
    installStorageMocks();

    await generatePrescriptionPdfFile(BASE_PRESCRIPTION.id);

    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    const fileName = uploadPrescriptionPdf.mock.calls[0][1] as string;
    expect(fileName).toMatch(
      new RegExp(`^prescription_${BASE_PRESCRIPTION.id}_v5_[0-9a-f-]{36}\\.pdf$`)
    );
  });
});

describe('ensurePrescriptionPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PDF_DOCUMENT_MOCK.__instances.length = 0;
    _clearInFlightUpgrades();
  });

  it('regenerates a legacy artifact and changes only the stored PDF reference', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    installQueryMock({ storedPdfUrl: legacyPath });
    installStorageMocks();

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(uploadPrescriptionPdf.mock.calls[0][1]).toContain('_v5_');
    expect(result.signedUrl).toBe('https://storage.example.com/rx.pdf');

    const writes = query.mock.calls
      .map((call: any[]) => String(call[0]))
      .filter((sql: string) => !sql.trim().startsWith('SELECT'));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/^UPDATE prescriptions SET pdf_url = \$1, updated_at = CURRENT_TIMESTAMP WHERE id = \$2/);

    const updateParams = query.mock.calls.find((call: any[]) =>
      String(call[0]).startsWith('UPDATE prescriptions')
    )![1];
    expect(updateParams[0]).toBe('prescription_1.pdf');
    expect(updateParams[1]).toBe(BASE_PRESCRIPTION.id);
  });

  it('regenerates a v2 artifact after the signature block layout change', async () => {
    const previousLayoutPath = `prescription_${BASE_PRESCRIPTION.id}_v2_12345678-1234-1234-1234-123456789abc.pdf`;
    installQueryMock({ storedPdfUrl: previousLayoutPath });
    installStorageMocks();

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(uploadPrescriptionPdf.mock.calls[0][1]).toContain('_v5_');
    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith('prescription_1.pdf');
  });

  it('regenerates a v3 artifact after the prescription color update', async () => {
    const previousLayoutPath = `prescription_${BASE_PRESCRIPTION.id}_v3_12345678-1234-1234-1234-123456789abc.pdf`;
    installQueryMock({ storedPdfUrl: previousLayoutPath });
    installStorageMocks();

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(uploadPrescriptionPdf.mock.calls[0][1]).toContain('_v5_');
    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith('prescription_1.pdf');
  });

  it('regenerates a v4 artifact after the unboxed layout update', async () => {
    const previousLayoutPath = `prescription_${BASE_PRESCRIPTION.id}_v4_12345678-1234-1234-1234-123456789abc.pdf`;
    installQueryMock({ storedPdfUrl: previousLayoutPath });
    installStorageMocks();

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(uploadPrescriptionPdf.mock.calls[0][1]).toContain('_v5_');
    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith('prescription_1.pdf');
  });

  it('serves a current artifact without regenerating it', async () => {
    const currentPath = `prescription_${BASE_PRESCRIPTION.id}_v5_12345678-1234-1234-1234-123456789abc.pdf`;
    installQueryMock({ storedPdfUrl: currentPath });
    installStorageMocks();

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith(currentPath);
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
    expect(PDF_DOCUMENT_MOCK.__instances).toHaveLength(0);
    expect(result.signedUrl).toBe('https://storage.example.com/rx.pdf');
  });

  it('accepts a current artifact stored as a full URL', async () => {
    const currentPath = `https://example.supabase.co/storage/v1/object/private/prescription-pdfs/prescription_${BASE_PRESCRIPTION.id}_v5_12345678-1234-1234-1234-123456789abc.pdf`;
    installQueryMock({ storedPdfUrl: currentPath });
    installStorageMocks();

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(true);
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
  });

  it('fails when a current artifact cannot be signed', async () => {
    const currentPath = `prescription_${BASE_PRESCRIPTION.id}_v5_12345678-1234-1234-1234-123456789abc.pdf`;
    installQueryMock({ storedPdfUrl: currentPath });
    installStorageMocks({ signedUrlFails: true });

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe('signed url failed');
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
  });

  it('fails without generating when the prescription does not exist', async () => {
    installQueryMock();

    const result = await ensurePrescriptionPdf('missing-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Prescription not found');
    expect(PDF_DOCUMENT_MOCK.__instances).toHaveLength(0);
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
  });

  it('fails when a legacy artifact cannot be regenerated', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    installQueryMock({ storedPdfUrl: legacyPath });
    installStorageMocks({ uploadFails: true });

    const result = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(result.success).toBe(false);
    expect(result.error).toBe('upload failed');
    const updates = query.mock.calls.filter((call: any[]) =>
      String(call[0]).startsWith('UPDATE prescriptions')
    );
    expect(updates).toHaveLength(0);
  });

  it('coalesces concurrent requests for the same legacy prescription to prevent redundant generation and uploads', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    installQueryMock({ storedPdfUrl: legacyPath });
    installStorageMocks();

    const [res1, res2, res3] = await Promise.all([
      ensurePrescriptionPdf(BASE_PRESCRIPTION.id),
      ensurePrescriptionPdf(BASE_PRESCRIPTION.id),
      ensurePrescriptionPdf(BASE_PRESCRIPTION.id),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);
    expect(res1.signedUrl).toBe('https://storage.example.com/rx.pdf');
    expect(res2.signedUrl).toBe('https://storage.example.com/rx.pdf');
    expect(res3.signedUrl).toBe('https://storage.example.com/rx.pdf');

    // PDFKit document, upload, and update happen only once across concurrent requests
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    const updates = query.mock.calls.filter((call: any[]) =>
      String(call[0]).startsWith('UPDATE prescriptions')
    );
    expect(updates).toHaveLength(1);
  });

  it('handles repeated sequential requests by serving the updated artifact on subsequent calls', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    let currentStoredUrl = legacyPath;

    query.mockImplementation((sql: string, params: any[]) => {
      const text = String(sql);
      if (text.includes('p.updated_at AS pdf_updated_at')) {
        return Promise.resolve({ rows: [{
          pdf_url: currentStoredUrl,
          pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
          signature_url: BASE_PRESCRIPTION.signature_url,
          doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
        }] });
      }
      if (text.startsWith('UPDATE prescriptions')) {
        currentStoredUrl = params[0];
        return Promise.resolve({ rowCount: 1 });
      }
      if (text.includes('FROM prescriptions p')) {
        return Promise.resolve({ rows: [{ ...BASE_PRESCRIPTION, pdf_url: currentStoredUrl }] });
      }
      if (text.includes('FROM prescription_items')) {
        return Promise.resolve({ rows: BASE_ITEMS });
      }
      return Promise.resolve({ rows: [] });
    });

    installStorageMocks();

    // Call 1: upgrades legacy PDF
    const result1 = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);
    expect(result1.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(currentStoredUrl).toBe('prescription_1.pdf');

    // Call 2: repeated request with v5 artifact already persisted
    currentStoredUrl = `prescription_${BASE_PRESCRIPTION.id}_v5_12345678-1234-1234-1234-123456789abc.pdf`;
    const result2 = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);
    expect(result2.success).toBe(true);
    // uploadPrescriptionPdf was NOT called again
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith(currentStoredUrl);
  });

  it('allows subsequent requests to retry if the first upgrade fails', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    installQueryMock({ storedPdfUrl: legacyPath });
    installStorageMocks({ uploadFails: true });

    const failedResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);
    expect(failedResult.success).toBe(false);

    // After failure, inFlightUpgrades must be cleared so retry is allowed
    installStorageMocks({ uploadFails: false });
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);
    expect(retryResult.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(2);
  });

  it('handles Supabase Storage upload failure during regeneration, preserving the original PDF and allowing retry', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    let currentStoredUrl = legacyPath;

    query.mockImplementation((sql: string, params: any[]) => {
      const text = String(sql);
      if (text.includes('p.updated_at AS pdf_updated_at')) {
        return Promise.resolve({ rows: [{
          pdf_url: currentStoredUrl,
          pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
          signature_url: BASE_PRESCRIPTION.signature_url,
          doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
        }] });
      }
      if (text.startsWith('UPDATE prescriptions')) {
        currentStoredUrl = params[0];
        return Promise.resolve({ rowCount: 1 });
      }
      if (text.includes('FROM prescriptions p')) {
        return Promise.resolve({ rows: [{ ...BASE_PRESCRIPTION, pdf_url: currentStoredUrl }] });
      }
      if (text.includes('FROM prescription_items')) {
        return Promise.resolve({ rows: BASE_ITEMS });
      }
      return Promise.resolve({ rows: [] });
    });

    // Step 1: Upload fails
    installStorageMocks({ uploadFails: true });
    const failResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(failResult.success).toBe(false);
    expect(failResult.error).toBe('upload failed');
    // Database record was not updated; previously working PDF remains untouched
    expect(currentStoredUrl).toBe(legacyPath);
    expect(query.mock.calls.some((c: any[]) => String(c[0]).startsWith('UPDATE prescriptions'))).toBe(false);

    // Step 2: Storage recovers and retry succeeds
    installStorageMocks({ uploadFails: false });
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(retryResult.success).toBe(true);
    expect(retryResult.signedUrl).toBe('https://storage.example.com/rx.pdf');
    expect(currentStoredUrl).toBe('prescription_1.pdf');
  });

  it('handles PDF generation failure when doctor signature cannot be downloaded, preserving original PDF and allowing retry', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    let currentStoredUrl = legacyPath;

    query.mockImplementation((sql: string, params: any[]) => {
      const text = String(sql);
      if (text.includes('p.updated_at AS pdf_updated_at')) {
        return Promise.resolve({ rows: [{
          pdf_url: currentStoredUrl,
          pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
          signature_url: BASE_PRESCRIPTION.signature_url,
          doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
        }] });
      }
      if (text.startsWith('UPDATE prescriptions')) {
        currentStoredUrl = params[0];
        return Promise.resolve({ rowCount: 1 });
      }
      if (text.includes('FROM prescriptions p')) {
        return Promise.resolve({ rows: [{ ...BASE_PRESCRIPTION, pdf_url: currentStoredUrl }] });
      }
      if (text.includes('FROM prescription_items')) {
        return Promise.resolve({ rows: BASE_ITEMS });
      }
      return Promise.resolve({ rows: [] });
    });

    // Step 1: Signature download fails
    installStorageMocks({ downloadFails: true });
    const failResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(failResult.success).toBe(false);
    expect(failResult.error).toContain('signature could not be retrieved');
    // PDF upload and DB update must NOT be executed on generation failure
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
    expect(currentStoredUrl).toBe(legacyPath);

    // Step 2: Signature download recovers and retry succeeds
    installStorageMocks({ downloadFails: false });
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(retryResult.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(currentStoredUrl).toBe('prescription_1.pdf');
  });

  it('handles PDF generation failure when doctor signature cannot be embedded, preserving original PDF and allowing retry', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    let currentStoredUrl = legacyPath;

    query.mockImplementation((sql: string, params: any[]) => {
      const text = String(sql);
      if (text.includes('p.updated_at AS pdf_updated_at')) {
        return Promise.resolve({ rows: [{
          pdf_url: currentStoredUrl,
          pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
          signature_url: BASE_PRESCRIPTION.signature_url,
          doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
        }] });
      }
      if (text.startsWith('UPDATE prescriptions')) {
        currentStoredUrl = params[0];
        return Promise.resolve({ rowCount: 1 });
      }
      if (text.includes('FROM prescriptions p')) {
        return Promise.resolve({ rows: [{ ...BASE_PRESCRIPTION, pdf_url: currentStoredUrl }] });
      }
      if (text.includes('FROM prescription_items')) {
        return Promise.resolve({ rows: BASE_ITEMS });
      }
      return Promise.resolve({ rows: [] });
    });

    // Step 1: PDFKit rejects the preprocessed signature image
    installStorageMocks({ signatureBuffer: PNG_SIGNATURE });
    PDF_DOCUMENT_MOCK.__failImage = true;
    const failResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(failResult.success).toBe(false);
    expect(failResult.error).toContain('could not be embedded');
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();
    expect(currentStoredUrl).toBe(legacyPath);

    // Step 2: PDFKit accepts the valid signature on retry
    PDF_DOCUMENT_MOCK.__failImage = false;
    installStorageMocks({ signatureBuffer: PNG_SIGNATURE });
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(retryResult.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    expect(currentStoredUrl).toBe('prescription_1.pdf');
    errorSpy.mockRestore();
  });

  it('handles database read failure during PDF generation gracefully, preserving state and allowing retry', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    let failPrescriptionQuery = true;

    query.mockImplementation((sql: string) => {
      const text = String(sql);
      if (text.includes('p.updated_at AS pdf_updated_at')) {
        return Promise.resolve({ rows: [{
          pdf_url: legacyPath,
          pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
          signature_url: BASE_PRESCRIPTION.signature_url,
          doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
        }] });
      }
      if (text.includes('FROM prescriptions p')) {
        if (failPrescriptionQuery) {
          return Promise.reject(new Error('Connection terminated unexpectedly'));
        }
        return Promise.resolve({ rows: [BASE_PRESCRIPTION] });
      }
      if (text.includes('FROM prescription_items')) {
        return Promise.resolve({ rows: BASE_ITEMS });
      }
      if (text.startsWith('UPDATE prescriptions')) {
        return Promise.resolve({ rowCount: 1 });
      }
      return Promise.resolve({ rows: [] });
    });

    installStorageMocks();

    // Step 1: DB query throws
    const failResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);
    expect(failResult.success).toBe(false);
    expect(failResult.error).toContain('Connection terminated unexpectedly');
    expect(uploadPrescriptionPdf).not.toHaveBeenCalled();

    // Step 2: DB connection recovers; retry succeeds
    failPrescriptionQuery = false;
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);
    expect(retryResult.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  it('handles database update failure after successful upload, preserving original PDF and allowing retry', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    let currentStoredUrl = legacyPath;
    let failUpdate = true;

    query.mockImplementation((sql: string, params: any[]) => {
      const text = String(sql);
      if (text.includes('p.updated_at AS pdf_updated_at')) {
        return Promise.resolve({ rows: [{
          pdf_url: currentStoredUrl,
          pdf_updated_at: new Date('2026-11-18T00:00:00.000Z'),
          signature_url: BASE_PRESCRIPTION.signature_url,
          doctor_updated_at: new Date('2026-11-17T00:00:00.000Z'),
        }] });
      }
      if (text.startsWith('UPDATE prescriptions')) {
        if (failUpdate) {
          return Promise.reject(new Error('deadlock detected'));
        }
        currentStoredUrl = params[0];
        return Promise.resolve({ rowCount: 1 });
      }
      if (text.includes('FROM prescriptions p')) {
        return Promise.resolve({ rows: [{ ...BASE_PRESCRIPTION, pdf_url: currentStoredUrl }] });
      }
      if (text.includes('FROM prescription_items')) {
        return Promise.resolve({ rows: BASE_ITEMS });
      }
      return Promise.resolve({ rows: [] });
    });

    installStorageMocks();

    // Step 1: Upload succeeds, but UPDATE query throws
    const failResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(failResult.success).toBe(false);
    expect(failResult.error).toBe('Failed to save the generated prescription PDF');
    // Even though upload occurred, DB update failed so original PDF URL in DB is untouched
    expect(currentStoredUrl).toBe(legacyPath);
    // Signed URL must not be generated for unpersisted file
    expect(generateSignedPrescriptionUrl).not.toHaveBeenCalled();

    // Step 2: Database recovers; retry succeeds and persists new URL
    failUpdate = false;
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(retryResult.success).toBe(true);
    expect(currentStoredUrl).toBe('prescription_1.pdf');
    expect(generateSignedPrescriptionUrl).toHaveBeenCalledWith('prescription_1.pdf');
    errorSpy.mockRestore();
  });

  it('clears in-flight entries on failure so concurrent failed requests do not block future retries', async () => {
    const legacyPath = `prescription_${BASE_PRESCRIPTION.id}_99999999-8888-7777-6666-555555555555.pdf`;
    installQueryMock({ storedPdfUrl: legacyPath });
    installStorageMocks({ uploadFails: true });

    // Concurrent callers during failing upload
    const [res1, res2, res3] = await Promise.all([
      ensurePrescriptionPdf(BASE_PRESCRIPTION.id),
      ensurePrescriptionPdf(BASE_PRESCRIPTION.id),
      ensurePrescriptionPdf(BASE_PRESCRIPTION.id),
    ]);

    expect(res1.success).toBe(false);
    expect(res2.success).toBe(false);
    expect(res3.success).toBe(false);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(1);

    // After failure completes, map is completely cleared; subsequent request immediately retries
    installStorageMocks({ uploadFails: false });
    const retryResult = await ensurePrescriptionPdf(BASE_PRESCRIPTION.id);

    expect(retryResult.success).toBe(true);
    expect(uploadPrescriptionPdf).toHaveBeenCalledTimes(2);
  });
});
