import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';
import {
  uploadPrescriptionPdf,
  generateSignedPrescriptionUrl,
  downloadDoctorSignature,
} from './storageService';
import {
  buildPrescriptionDownloadFileName,
  buildPrescriptionNumber,
  parseDateParts as dateParts,
} from './prescriptionFileName';

export {
  buildPrescriptionDownloadFileName,
  buildPrescriptionNumber,
} from './prescriptionFileName';

interface PdfResult {
  success: boolean;
  signedUrl?: string;
  filePath?: string;
  error?: string;
}

/**
 * Identifies which PDF layout produced a stored artifact.
 *
 * PDFs are regenerable artifacts rather than medical records, so the layout can
 * change without touching a prescription. The version is embedded in the
 * storage object name (`prescription_<id>_v5_<uuid>.pdf`) because there is no
 * dedicated column for it. Older artifacts are regenerated on demand.
 */
export const PRESCRIPTION_PDF_LAYOUT_VERSION = 'v5';

function isCurrentPdfLayout(pdfUrl?: string | null): boolean {
  const value = String(pdfUrl || '').trim();
  if (!value) return false;
  const fileName = value.split('/').pop() || value;
  return fileName.includes(`_${PRESCRIPTION_PDF_LAYOUT_VERSION}_`);
}

// ---------------------------------------------------------------------------
// Layout constants (A4, points)
// ---------------------------------------------------------------------------
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
// Content stops above the footer so the footer can never overlap the body.
const BOTTOM_LIMIT = PAGE_HEIGHT - 78;

const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';

const COLORS = {
  navy: '#000000',
  slate: '#000000',
  muted: '#000000',
  border: '#777777',
  soft: '#FFFFFF',
  blue: '#243B53',
  blueSoft: '#FFFFFF',
  blueBorder: '#777777',
  teal: '#243B53',
  white: '#FFFFFF',
};

interface PanelRow {
  text: string;
  font: string;
  size: number;
  color: string;
  lineHeight: number;
  gap: number;
}

interface MeasuredRow extends PanelRow {
  lines: string[];
}

function clean(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
}

function calculateAge(dateOfBirth?: string | Date | null): number | null {
  const dob = dateParts(dateOfBirth);
  if (!dob) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.year;
  const monthDiff = today.getMonth() + 1 - dob.month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.day)) {
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(value?: string | Date | null): string | null {
  const parts = dateParts(value);
  if (!parts) return null;
  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

function fullName(first?: string | null, middle?: string | null, last?: string | null): string {
  return [first, middle, last].filter(Boolean).join(' ');
}

/**
 * Wrap text into visual lines using the document's current font metrics.
 * Line-by-line rendering keeps page breaks predictable and prevents headings
 * or medication blocks from being split in the middle of a section.
 */
function layoutTextLines(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: string,
  size: number
): string[] {
  const value = String(text ?? '');
  if (value.length === 0 || width <= 0) return [];

  doc.font(font).fontSize(size);
  const lines: string[] = [];
  const paragraphs = value.replace(/\r\n/g, '\n').split('\n');

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (doc.widthOfString(candidate) <= width) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);

      if (doc.widthOfString(word) <= width) {
        current = word;
        continue;
      }

      // Extremely long token: break it by characters so it cannot overflow.
      let chunk = '';
      for (const character of word) {
        if (doc.widthOfString(chunk + character) <= width) {
          chunk += character;
        } else {
          if (chunk) lines.push(chunk);
          chunk = character;
        }
      }
      current = chunk;
    }

    if (current) lines.push(current);
  }

  return lines;
}

function measureRows(
  doc: PDFKit.PDFDocument,
  rows: PanelRow[],
  width: number
): MeasuredRow[] {
  return rows
    .filter((row) => row.text.length > 0)
    .map((row) => ({
      ...row,
      lines: layoutTextLines(doc, row.text, width, row.font, row.size),
    }));
}

function measuredRowsHeight(rows: MeasuredRow[]): number {
  return rows.reduce(
    (total, row) => total + row.lines.length * row.lineHeight + row.gap,
    0
  );
}

function truncateToWidth(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: string,
  size: number
): string {
  const value = String(text ?? '');
  doc.font(font).fontSize(size);
  if (doc.widthOfString(value) <= width) return value;

  let shortened = value;
  while (shortened.length > 1 && doc.widthOfString(`${shortened}...`) > width) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened.replace(/\s+$/, '')}...`;
}

/**
 * Render, upload and persist the PDF for an issued prescription.
 * The caller is expected to have already ensured the prescription belongs to
 * the requesting doctor. Returns a short-lived signed URL on success.
 */
export async function generatePrescriptionPdfFile(prescriptionId: string): Promise<PdfResult> {
  try {
    const prescriptionResult = await query(
    `SELECT p.*,
            pat.first_name AS patient_first_name, pat.middle_name AS patient_middle_name,
            pat.last_name AS patient_last_name, pat.date_of_birth, pat.sex,
            pat.address AS patient_address,
            d.first_name AS doctor_first_name, d.middle_name AS doctor_middle_name,
            d.last_name AS doctor_last_name, d.credentials AS doctor_credentials,
            d.practice_name, d.practice_address, d.practice_phone, d.practice_email,
            d.room_number, d.specialty, d.prc_license_number, d.signature_url,
            v.visit_date, v.reason_for_visit, v.diagnosis,
            a.appointment_date,
            EXISTS (
              SELECT 1 FROM prescriptions replacement
              WHERE replacement.replaces_prescription_id = p.id
            ) AS is_superseded
     FROM prescriptions p
     JOIN patients pat ON p.patient_id = pat.id
     JOIN doctors d ON p.doctor_id = d.id
     JOIN visits v ON p.visit_id = v.id
     LEFT JOIN appointments a ON v.appointment_id = a.id
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

  // Replacement prescriptions reference the original prescription number.
  let replacedPrescription: any = null;
  if (prescription.replaces_prescription_id) {
    const replacedResult = await query(
      'SELECT id, prescription_date FROM prescriptions WHERE id = $1',
      [prescription.replaces_prescription_id]
    );
    replacedPrescription = replacedResult.rows[0] || null;
  }

  // The signature is mandatory when the doctor has one stored. If the object
  // cannot be retrieved, generation fails instead of silently printing a PDF
  // without the expected signature.
  let signatureBuffer: Buffer | null = null;
  if (prescription.signature_url) {
    const signatureResult = await downloadDoctorSignature(prescription.signature_url);
    if (!signatureResult.success || !signatureResult.buffer || signatureResult.buffer.length === 0) {
      return {
        success: false,
        error:
          'The doctor\'s signature could not be retrieved from private storage, so the prescription PDF was not generated. Please re-upload the signature and try again.',
      };
    }
    // Flatten transparency to a white background so PDFKit embeds the image
    // correctly regardless of whether the PNG has an alpha channel.
    try {
      signatureBuffer = await sharp(signatureResult.buffer)
        .png({ force: true })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .toBuffer();
    } catch (sharpError: any) {
      console.error('Failed to preprocess doctor signature image:', sharpError);
      return {
        success: false,
        error:
          'The stored doctor signature could not be processed. Please re-upload a valid PNG signature and try again.',
      };
    }
  }

  const doctorName = fullName(
    prescription.doctor_first_name,
    prescription.doctor_middle_name,
    prescription.doctor_last_name
  );
  const doctorDisplayName = doctorName ? `Dr. ${doctorName}` : 'Doctor';
  const doctorCredentials = clean(prescription.doctor_credentials);
  const doctorWithCredentials = doctorCredentials
    ? `${doctorDisplayName}, ${doctorCredentials}`
    : doctorDisplayName;

  const patientName = fullName(
    prescription.patient_first_name,
    prescription.patient_middle_name,
    prescription.patient_last_name
  ) || 'Patient';

  const clinicName = clean(prescription.practice_name) || doctorDisplayName;
  const clinicAddress = clean(prescription.practice_address);
  const roomNumber = clean(prescription.room_number);
  const clinicContact = [clean(prescription.practice_phone), clean(prescription.practice_email)]
    .filter(Boolean)
    .join(' | ');
  const clinicAddressLine = [clinicAddress, roomNumber ? `Room ${roomNumber}` : '']
    .filter(Boolean)
    .join(' | ');
  const patientAddress = clean(prescription.patient_address);

  const age = calculateAge(prescription.date_of_birth);
  const sex = formatSex(prescription.sex);
  const prescriptionNumber = buildPrescriptionNumber(prescription.id, prescription.prescription_date);
  const downloadFileName = buildPrescriptionDownloadFileName({
    prescriptionId: prescription.id,
    prescriptionDate: prescription.prescription_date,
    patientFirstName: prescription.patient_first_name,
    patientLastName: prescription.patient_last_name,
    replacesPrescriptionId: prescription.replaces_prescription_id,
    replacesPrescriptionDate: replacedPrescription?.prescription_date,
    superseded: Boolean(prescription.is_superseded),
  });
  const issueDate = formatDate(prescription.prescription_date) || formatDate(new Date()) || '-';
  const visitDate = formatDate(prescription.visit_date) || formatDate(prescription.appointment_date);

  const notes = clean(prescription.notes);
  const diagnosis = clean(prescription.diagnosis);
  const reasonForVisit = clean(prescription.reason_for_visit);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: 72, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: downloadFileName,
      Author: doctorDisplayName,
      Subject: 'Medical Prescription',
      Creator: 'FindMyDoctor',
    },
  });
  const chunks: Buffer[] = [];

  const finished = new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });

  let cursorY = 0;

  const drawRule = (y: number, x = MARGIN, width = CONTENT_WIDTH) => {
    doc
      .moveTo(x, y)
      .lineTo(x + width, y)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
  };

  const drawPageFooter = (pageIndex: number, totalPages: number) => {
    const dividerY = PAGE_HEIGHT - 60;
    const primaryY = PAGE_HEIGHT - 50;
    const secondaryY = PAGE_HEIGHT - 39;
    const footerWidth = CONTENT_WIDTH - 88;

    drawRule(dividerY);

    const primary = truncateToWidth(doc, clinicName, footerWidth, FONT_BOLD, 7);
    doc
      .font(FONT_BOLD)
      .fontSize(7)
      .fillColor(COLORS.navy)
      .text(primary, MARGIN, primaryY, { width: footerWidth, lineBreak: false });

    const secondaryParts = [clinicAddressLine, clinicContact].filter(Boolean);
    if (secondaryParts.length > 0) {
      const secondary = truncateToWidth(
        doc,
        secondaryParts.join(' | '),
        footerWidth,
        FONT_REGULAR,
        6.7
      );
      doc
        .font(FONT_REGULAR)
        .fontSize(6.7)
        .fillColor(COLORS.muted)
        .text(secondary, MARGIN, secondaryY, { width: footerWidth, lineBreak: false });
    }

    doc
      .font(FONT_REGULAR)
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(`Page ${pageIndex} of ${totalPages}`, PAGE_WIDTH - MARGIN - 76, primaryY, {
        width: 76,
        align: 'right',
        lineBreak: false,
      });
  };

  const drawContinuationHeader = () => {
    const headerWidth = CONTENT_WIDTH - 156;
    doc
      .font(FONT_BOLD)
      .fontSize(9.4)
      .fillColor(COLORS.navy)
      .text(
        truncateToWidth(doc, clinicName, headerWidth, FONT_BOLD, 9.4),
        MARGIN,
        38,
        { width: headerWidth, lineBreak: false }
      );

    const contactLine = [clinicAddressLine, clinicContact].filter(Boolean).join(' | ');
    if (contactLine) {
      doc
        .font(FONT_REGULAR)
        .fontSize(7.4)
        .fillColor(COLORS.muted)
        .text(
          truncateToWidth(doc, contactLine, headerWidth, FONT_REGULAR, 7.4),
          MARGIN,
          50,
          { width: headerWidth, lineBreak: false }
        );
    }

    doc
      .font(FONT_BOLD)
      .fontSize(7.4)
      .fillColor(COLORS.blue)
      .text(`Rx ${prescriptionNumber}`, PAGE_WIDTH - MARGIN - 146, 38, {
        width: 146,
        align: 'right',
        lineBreak: false,
      });
    doc
      .font(FONT_REGULAR)
      .fontSize(6.8)
      .fillColor(COLORS.muted)
      .text('Continued', PAGE_WIDTH - MARGIN - 146, 50, {
        width: 146,
        align: 'right',
        lineBreak: false,
      });

    drawRule(70);

    cursorY = 80;
  };

  const addPage = () => {
    doc.addPage();
    drawContinuationHeader();
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height > BOTTOM_LIMIT) {
      addPage();
    }
  };

  const drawSectionHeading = (label: string) => {
    ensureSpace(26);
    doc
      .font(FONT_BOLD)
      .fontSize(8.6)
      .fillColor(COLORS.teal)
      .text(label, MARGIN, cursorY, {
        width: CONTENT_WIDTH,
        characterSpacing: 0.8,
        lineBreak: false,
      });
    cursorY += 12;
    drawRule(cursorY);
    cursorY += 8;
  };

  const drawInfoBlock = (
    x: number,
    y: number,
    width: number,
    label: string,
    rows: MeasuredRow[]
  ) => {
    doc
      .font(FONT_BOLD)
      .fontSize(7.1)
      .fillColor(COLORS.teal)
      .text(label, x, y, {
        width,
        characterSpacing: 0.7,
        lineBreak: false,
      });

    const labelRuleY = y + 12;
    drawRule(labelRuleY, x, width);

    let rowY = labelRuleY + 7;
    for (const row of rows) {
      doc.font(row.font).fontSize(row.size).fillColor(row.color);
      for (const line of row.lines) {
        if (line) {
          doc.text(line, x, rowY, { width, lineBreak: false });
        }
        rowY += row.lineHeight;
      }
      rowY += row.gap;
    }
  };

  const drawLabeledParagraph = (label: string, text: string) => {
    const labelWidth = 82;
    const textWidth = CONTENT_WIDTH - labelWidth;
    const lines = layoutTextLines(doc, text, textWidth, FONT_REGULAR, 9);
    if (lines.length === 0) return;

    const lineHeight = 11.8;
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= BOTTOM_LIMIT - cursorY) {
      // Keep the whole paragraph together when it fits on the current page.
    } else if (totalHeight <= BOTTOM_LIMIT - 86) {
      addPage();
    } else {
      ensureSpace(lineHeight * 3);
    }

    doc
      .font(FONT_BOLD)
      .fontSize(7.4)
      .fillColor(COLORS.muted)
      .text(label.toUpperCase(), MARGIN, cursorY + 1, {
        width: labelWidth - 6,
        characterSpacing: 0.3,
        lineBreak: false,
      });

    for (const line of lines) {
      if (cursorY + lineHeight > BOTTOM_LIMIT) {
        addPage();
      }
      if (line) {
        doc
          .font(FONT_REGULAR)
          .fontSize(9)
          .fillColor(COLORS.navy)
          .text(line, MARGIN + labelWidth, cursorY, { width: textWidth, lineBreak: false });
      }
      cursorY += lineHeight;
    }

    cursorY += 5;
  };

  // -------------------------------------------------------------------------
  // Page 1 header: clinic identity. Missing clinic fields are omitted rather
  // than replaced with dummy values.
  // -------------------------------------------------------------------------
  let headerY = 40;

  doc
    .font(FONT_BOLD)
    .fontSize(12)
    .fillColor(COLORS.teal)
    .text(clinicName.toUpperCase(), MARGIN, headerY, {
      width: CONTENT_WIDTH,
      characterSpacing: 0.5,
    });
  headerY = doc.y + 2;

  if (clinicAddressLine) {
    doc
      .font(FONT_REGULAR)
      .fontSize(8.2)
      .fillColor(COLORS.muted)
      .text(clinicAddressLine, MARGIN, headerY, { width: CONTENT_WIDTH });
    headerY = doc.y + 1;
  }

  if (clinicContact) {
    doc
      .font(FONT_REGULAR)
      .fontSize(8.2)
      .fillColor(COLORS.muted)
      .text(clinicContact, MARGIN, headerY, { width: CONTENT_WIDTH });
    headerY = doc.y + 1;
  }

  cursorY = headerY + 8;
  drawRule(cursorY);
  cursorY += 10;

  // -------------------------------------------------------------------------
  // Title and prescription identification
  // -------------------------------------------------------------------------
  const metaWidth = 190;
  const metaX = PAGE_WIDTH - MARGIN - metaWidth;

  doc
    .font(FONT_BOLD)
    .fontSize(15.5)
    .fillColor(COLORS.navy)
    .text('MEDICAL PRESCRIPTION', MARGIN, cursorY - 1, {
      width: CONTENT_WIDTH - metaWidth - 12,
      characterSpacing: 1.1,
    });
  const titleBottom = doc.y;

  let metaY = cursorY - 1;
  const metaEntries: Array<{
    label?: string;
    value: string;
    strong?: boolean;
    italic?: boolean;
  }> = [
    { label: 'PRESCRIPTION NO.', value: prescriptionNumber, strong: true },
  ];
  if (replacedPrescription) {
    const originalNumber = buildPrescriptionNumber(
      replacedPrescription.id,
      replacedPrescription.prescription_date
    );
    const originalDate = formatDate(replacedPrescription.prescription_date);
    metaEntries.push({
      value: originalDate
        ? `Replacement for prescription ${originalNumber} (issued ${originalDate}). This prescription supersedes it.`
        : `Replacement for prescription ${originalNumber}. This prescription supersedes it.`,
      italic: true,
    });
  }
  metaEntries.push({ label: 'DATE ISSUED', value: issueDate });
  if (visitDate) {
    metaEntries.push({ label: 'VISIT DATE', value: visitDate });
  }

  for (const entry of metaEntries) {
    if (entry.label) {
      doc
        .font(FONT_BOLD)
        .fontSize(6.3)
        .fillColor(COLORS.muted)
        .text(entry.label, metaX, metaY, {
          width: metaWidth,
          align: 'right',
          characterSpacing: 0.4,
          lineBreak: false,
        });
      metaY += 8;
    }
    const valueLines = entry.italic
      ? layoutTextLines(doc, entry.value, metaWidth, FONT_ITALIC, 6.8)
      : [entry.value];
    const valueLineHeight = entry.italic ? 8 : 11;
    doc
      .font(entry.italic ? FONT_ITALIC : entry.strong ? FONT_BOLD : FONT_REGULAR)
      .fontSize(entry.italic ? 6.8 : 8.6)
      .fillColor(entry.strong ? COLORS.blue : COLORS.navy);
    for (const line of valueLines) {
      doc.text(line, metaX, metaY, {
        width: metaWidth,
        align: 'right',
        lineBreak: false,
      });
      metaY += valueLineHeight;
    }
  }

  cursorY = Math.max(titleBottom, metaY) + 4;
  drawRule(cursorY);
  cursorY += 12;

  // -------------------------------------------------------------------------
  // Physician and patient information panels
  // -------------------------------------------------------------------------
  const panelGap = 10;
  const panelWidth = (CONTENT_WIDTH - panelGap) / 2;
  const panelInnerWidth = panelWidth - 4;

  const physicianRows = measureRows(
    doc,
    [
      {
        text: doctorWithCredentials,
        font: FONT_BOLD,
        size: 10.5,
        color: COLORS.navy,
        lineHeight: 12.5,
        gap: 3,
      },
      {
        text: clean(prescription.specialty),
        font: FONT_REGULAR,
        size: 8.7,
        color: COLORS.navy,
        lineHeight: 11,
        gap: 2,
      },
      {
        text: clean(prescription.prc_license_number)
          ? `PRC License No.: ${clean(prescription.prc_license_number)}`
          : '',
        font: FONT_REGULAR,
        size: 8.4,
        color: COLORS.slate,
        lineHeight: 10.6,
        gap: 1,
      },
    ],
    panelInnerWidth
  );

  const ageSexLine = [
    age !== null ? `Age: ${age}` : '',
    sex ? `Sex: ${sex}` : '',
  ]
    .filter(Boolean)
    .join('     ');

  const patientRows = measureRows(
    doc,
    [
      {
        text: patientName,
        font: FONT_BOLD,
        size: 10.5,
        color: COLORS.navy,
        lineHeight: 12.5,
        gap: 3,
      },
      {
        text: ageSexLine,
        font: FONT_REGULAR,
        size: 8.6,
        color: COLORS.slate,
        lineHeight: 10.8,
        gap: 2,
      },
      {
        text: formatDate(prescription.date_of_birth)
          ? `Date of Birth: ${formatDate(prescription.date_of_birth)}`
          : '',
        font: FONT_REGULAR,
        size: 8.6,
        color: COLORS.slate,
        lineHeight: 10.8,
        gap: 2,
      },
      {
        text: patientAddress ? `Address: ${patientAddress}` : '',
        font: FONT_REGULAR,
        size: 8.6,
        color: COLORS.slate,
        lineHeight: 10.8,
        gap: 1,
      },
    ],
    panelInnerWidth
  );

  const physicianHeight = 19 + measuredRowsHeight(physicianRows);
  const patientHeight = 19 + measuredRowsHeight(patientRows);
  const panelHeight = Math.max(physicianHeight, patientHeight);

  ensureSpace(panelHeight + 14);
  drawInfoBlock(MARGIN, cursorY, panelWidth, 'PRESCRIBING PHYSICIAN', physicianRows);
  drawInfoBlock(
    MARGIN + panelWidth + panelGap,
    cursorY,
    panelWidth,
    'PATIENT INFORMATION',
    patientRows
  );
  cursorY += panelHeight + 14;

  // -------------------------------------------------------------------------
  // Clinical information
  // -------------------------------------------------------------------------
  if (diagnosis || reasonForVisit) {
    drawSectionHeading('CLINICAL INFORMATION');
    if (reasonForVisit) drawLabeledParagraph('Reason for visit', reasonForVisit);
    if (diagnosis) drawLabeledParagraph('Diagnosis', diagnosis);
    cursorY += 6;
  }

  // -------------------------------------------------------------------------
  // Medications
  // -------------------------------------------------------------------------
  ensureSpace(52);
  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(COLORS.blue)
    .text('Rx', MARGIN, cursorY, { lineBreak: false });
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(COLORS.navy)
    .text('MEDICATIONS', MARGIN + 22, cursorY, {
      width: CONTENT_WIDTH - 38,
      characterSpacing: 1.1,
      lineBreak: false,
    });
  cursorY += 20;

  const medicationColumns = [
    { label: 'No.', field: 'number', fraction: 0.05, font: FONT_REGULAR },
    { label: 'Medicine', field: 'medicine', fraction: 0.17, font: FONT_BOLD },
    { label: 'Dosage', field: 'dosage', fraction: 0.13, font: FONT_REGULAR },
    { label: 'Frequency', field: 'frequency', fraction: 0.14, font: FONT_REGULAR },
    { label: 'Duration', field: 'duration', fraction: 0.11, font: FONT_REGULAR },
    { label: 'Quantity', field: 'quantity', fraction: 0.09, font: FONT_REGULAR },
    { label: 'Instructions', field: 'instructions', fraction: 0.31, font: FONT_REGULAR },
  ].map((column) => ({ ...column, width: CONTENT_WIDTH * column.fraction }));

  const drawMedicationTableHeader = () => {
    drawRule(cursorY);
    const headerY = cursorY + 5;
    let columnX = MARGIN;
    for (const column of medicationColumns) {
      doc
        .font(FONT_BOLD)
        .fontSize(7.1)
        .fillColor(COLORS.navy)
        .text(column.label, columnX + 3, headerY, {
          width: column.width - 6,
          lineBreak: false,
        });
      columnX += column.width;
    }
    cursorY = headerY + 11;
    drawRule(cursorY);
    cursorY += 5;
  };

  const startMedicationContinuationPage = () => {
    addPage();
    drawMedicationTableHeader();
  };

  drawMedicationTableHeader();

  if (items.length === 0) {
    doc
      .font(FONT_ITALIC)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text('No medications recorded for this prescription.', MARGIN + 3, cursorY, {
        width: CONTENT_WIDTH - 16,
      });
    cursorY = doc.y + 5;
  }

  items.forEach((item: any, index: number) => {
    const quantity =
      item.quantity !== null && item.quantity !== undefined && item.quantity !== ''
        ? String(item.quantity)
        : '';
    const values = [
      String(index + 1),
      clean(item.medication_name) || 'Medication',
      clean(item.dosage),
      clean(item.frequency),
      clean(item.duration),
      quantity,
      clean(item.instructions),
    ];
    const cells = values.map((value, cellIndex) => {
      const column = medicationColumns[cellIndex];
      const fontSize = cellIndex === 0 ? 7.6 : 8.2;
      return {
        font: column.font,
        fontSize,
        x: medicationColumns
          .slice(0, cellIndex)
          .reduce((sum, previous) => sum + previous.width, MARGIN),
        width: column.width,
        lines: value
          ? layoutTextLines(doc, value, column.width - 6, column.font, fontSize)
          : [],
      };
    });
    const rowLineCount = Math.max(1, ...cells.map((cell) => cell.lines.length));
    const lineHeight = 10;
    const currentPageLines = Math.floor((BOTTOM_LIMIT - cursorY - 7) / lineHeight);
    const newPageLines = Math.floor((BOTTOM_LIMIT - 80 - 27) / lineHeight);

    if (rowLineCount <= newPageLines && rowLineCount > currentPageLines) {
      startMedicationContinuationPage();
    }

    let lineOffset = 0;
    while (lineOffset < rowLineCount) {
      let availableLines = Math.floor((BOTTOM_LIMIT - cursorY - 7) / lineHeight);
      if (availableLines <= 0) {
        startMedicationContinuationPage();
        availableLines = Math.floor((BOTTOM_LIMIT - cursorY - 7) / lineHeight);
      }

      const segmentLineCount = Math.min(rowLineCount - lineOffset, availableLines);
      for (const cell of cells) {
        for (let lineIndex = 0; lineIndex < segmentLineCount; lineIndex += 1) {
          const text = cell.lines[lineOffset + lineIndex];
          if (!text) continue;
          doc
            .font(cell.font)
            .fontSize(cell.fontSize)
            .fillColor(COLORS.navy)
            .text(text, cell.x + 3, cursorY + 2 + lineIndex * lineHeight, {
              width: cell.width - 6,
              lineBreak: false,
            });
        }
      }

      cursorY += segmentLineCount * lineHeight + 4;
      drawRule(cursorY);
      cursorY += 4;
      lineOffset += segmentLineCount;
      if (lineOffset < rowLineCount) {
        startMedicationContinuationPage();
      }
    }
  });

  // -------------------------------------------------------------------------
  // Additional instructions
  // -------------------------------------------------------------------------
  if (notes) {
    drawSectionHeading('ADDITIONAL INSTRUCTIONS');
    const lines = layoutTextLines(doc, notes, CONTENT_WIDTH - 16, FONT_REGULAR, 9);
    for (const line of lines) {
      if (cursorY + 12 > BOTTOM_LIMIT) {
        addPage();
      }
      if (line) {
        doc
          .font(FONT_REGULAR)
          .fontSize(9)
          .fillColor(COLORS.navy)
          .text(line, MARGIN + 8, cursorY, {
            width: CONTENT_WIDTH - 16,
            lineBreak: false,
          });
      }
      cursorY += 12;
    }
    cursorY += 6;
  }

  // -------------------------------------------------------------------------
  // Physician signature
  // -------------------------------------------------------------------------
  const signatureWidth = 205;
  const signatureX = PAGE_WIDTH - MARGIN - signatureWidth;
  const signatureAreaHeight = 44;
  const signatureInfoRows = [
    { value: doctorWithCredentials, font: FONT_BOLD, size: 8.7 },
    { value: clean(prescription.specialty), font: FONT_REGULAR, size: 7.6 },
    {
      value: clean(prescription.prc_license_number)
        ? `PRC License No.: ${clean(prescription.prc_license_number)}`
        : '',
      font: FONT_REGULAR,
      size: 7.4,
    },
  ]
    .filter((row) => row.value.length > 0)
    .map((row) => ({
      ...row,
      lines: layoutTextLines(doc, row.value, signatureWidth, row.font, row.size),
    }));
  const signatureInfoHeight = signatureInfoRows.reduce(
    (height, row) => height + row.lines.length * 10 + 2,
    0
  );

  const signatureBlockHeight =
    4 +
    signatureAreaHeight +
    6 +
    signatureInfoHeight;

  ensureSpace(signatureBlockHeight);
  const signatureTop = cursorY + 4;

  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, signatureX + 10, signatureTop, {
        fit: [signatureWidth - 20, signatureAreaHeight],
        align: 'center',
        valign: 'center',
      });
    } catch (imageError: any) {
      console.error('Failed to embed doctor signature image:', imageError);
      doc.end();
      return {
        success: false,
        error:
          'The stored doctor signature could not be embedded in the prescription PDF. Please re-upload a valid PNG signature and try again.',
      };
    }
  }

  const signatureLineY = signatureTop + signatureAreaHeight;
  drawRule(signatureLineY, signatureX, signatureWidth);

  let signatureInfoY = signatureLineY + 6;
  for (const row of signatureInfoRows) {
    for (const line of row.lines) {
      doc
        .font(row.font)
        .fontSize(row.size)
        .fillColor(COLORS.navy)
        .text(line, signatureX, signatureInfoY, {
          width: signatureWidth,
          align: 'center',
          lineBreak: false,
        });
      signatureInfoY += 10;
    }
    signatureInfoY += 2;
  }

  // Footer on every page. Pages are buffered so the total page count is known.
  const pageRange = doc.bufferedPageRange();
  const totalPages = pageRange.count;
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    doc.switchToPage(pageRange.start + pageIndex);
    // The footer intentionally sits inside the bottom margin. Disable the
    // margin for these writes so PDFKit does not auto-insert a blank page.
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    drawPageFooter(pageIndex + 1, totalPages);
    doc.page.margins.bottom = originalBottomMargin;
  }

  doc.end();
  await finished;

  const pdfBuffer = Buffer.concat(chunks);
  if (pdfBuffer.length === 0) {
    return { success: false, error: 'Failed to render prescription PDF' };
  }

  const fileName = `prescription_${prescriptionId}_${PRESCRIPTION_PDF_LAYOUT_VERSION}_${uuidv4()}.pdf`;

  const uploadResult = await uploadPrescriptionPdf(pdfBuffer, fileName);
  if (!uploadResult.success || !uploadResult.path) {
    return { success: false, error: uploadResult.error || 'Failed to upload PDF' };
  }

  try {
    await query(
      'UPDATE prescriptions SET pdf_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [uploadResult.path, prescriptionId]
    );
  } catch (dbError) {
    console.error('Failed to persist prescription PDF path:', dbError);
    return { success: false, error: 'Failed to save the generated prescription PDF' };
  }

  const signedUrlResult = await generateSignedPrescriptionUrl(uploadResult.path);
  if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
    return { success: false, error: signedUrlResult.error || 'Failed to generate signed URL' };
  }

  return {
    success: true,
    signedUrl: signedUrlResult.signedUrl,
    filePath: uploadResult.path,
  };
  } catch (err: any) {
    console.error('Failed to generate prescription PDF file:', err);
    return {
      success: false,
      error: err?.message || 'Failed to generate prescription PDF',
    };
  }
}

// In-flight upgrade promise map to coalesce concurrent requests for the same
// prescription, avoiding duplicate generation, redundant uploads, and database races.
const inFlightUpgrades = new Map<string, Promise<PdfResult>>();

export function _clearInFlightUpgrades(): void {
  inFlightUpgrades.clear();
}

/**
 * Return a download link for a prescription's PDF, upgrading a legacy artifact
 * in place when needed.
 *
 * The prescription row and its medication items are never modified. Only the
 * `pdf_url` artifact reference is refreshed, and the previously stored object is
 * left in storage. Artifacts already produced by the current layout are served
 * directly, so a prescription is regenerated at most once per layout change.
 *
 * Regeneration is also forced when the associated doctor updated their signature
 * after the prescription's PDF was last generated. This ensures that the
 * downloaded PDF always reflects the doctor's current signature.
 *
 * Concurrent requests for the same prescription share the single in-flight task.
 */
export async function ensurePrescriptionPdf(prescriptionId: string): Promise<PdfResult> {
  const inFlight = inFlightUpgrades.get(prescriptionId);
  if (inFlight) {
    return inFlight;
  }

  const upgradePromise = (async (): Promise<PdfResult> => {
    try {
      // Fetch the prescription's pdf_url and updated_at, plus the doctor's
      // signature_url and updated_at so we can detect stale cached PDFs.
      const storedResult = await query(
        `SELECT p.pdf_url, p.updated_at AS pdf_updated_at,
                d.signature_url, d.updated_at AS doctor_updated_at
         FROM prescriptions p
         JOIN doctors d ON p.doctor_id = d.id
         WHERE p.id = $1`,
        [prescriptionId]
      );

      if (storedResult.rows.length === 0) {
        return { success: false, error: 'Prescription not found' };
      }

      const { pdf_url: pdfUrl, pdf_updated_at, signature_url, doctor_updated_at } = storedResult.rows[0];

      if (isCurrentPdfLayout(pdfUrl)) {
        // If the doctor has a signature and updated it after the PDF was last
        // generated, regenerate so the new signature is embedded.
        if (signature_url && doctor_updated_at && pdf_updated_at) {
          const doctorUpdated = new Date(doctor_updated_at).getTime();
          const pdfGenerated = new Date(pdf_updated_at).getTime();
          if (doctorUpdated > pdfGenerated) {
            // Doctor's signature was updated after the cached PDF was generated.
            // Fall through to regeneration below.
          } else {
            const signedUrlResult = await generateSignedPrescriptionUrl(pdfUrl);
            if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
              return { success: false, error: signedUrlResult.error || 'Failed to generate signed URL' };
            }
            return { success: true, signedUrl: signedUrlResult.signedUrl, filePath: pdfUrl };
          }
        } else {
          // No signature (or no timestamp info) – return cached PDF as-is.
          const signedUrlResult = await generateSignedPrescriptionUrl(pdfUrl);
          if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
            return { success: false, error: signedUrlResult.error || 'Failed to generate signed URL' };
          }
          return { success: true, signedUrl: signedUrlResult.signedUrl, filePath: pdfUrl };
        }
      }

      return await generatePrescriptionPdfFile(prescriptionId);
    } catch (err: any) {
      console.error('Failed to ensure prescription PDF:', err);
      return {
        success: false,
        error: err?.message || 'Failed to prepare prescription PDF',
      };
    }
  })();

  inFlightUpgrades.set(prescriptionId, upgradePromise);
  try {
    return await upgradePromise;
  } finally {
    inFlightUpgrades.delete(prescriptionId);
  }
}
