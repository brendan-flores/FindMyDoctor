import PDFDocument from 'pdfkit';
import { InvoiceData } from '../types/invoice';
import * as fs from 'fs';
import * as path from 'path';

interface InvoicePdfOptions {
  output: 'buffer' | 'stream';
}

/**
 * Generate PDF invoice from invoice data
 */
export async function generateInvoicePdf(invoiceData: InvoiceData, options: InvoicePdfOptions = { output: 'buffer' }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const chunks: Buffer[] = [];

      if (options.output === 'buffer') {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      }

      // Helper function to format currency
      const formatCurrency = (amount: number): string => {
        return `PHP ${amount.toFixed(2)}`;
      };

      // Helper function to format date
      const formatDate = (date: string | Date): string => {
        const d = new Date(date);
        return d.toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      };

      // Helper function to draw a colored rectangle
      const drawBox = (x: number, y: number, width: number, height: number, fillColor: string, strokeColor?: string) => {
        doc.save();
        doc.fillColor(fillColor);
        if (strokeColor) {
          doc.strokeColor(strokeColor).lineWidth(0.5);
          doc.rect(x, y, width, height).fillAndStroke();
        } else {
          doc.rect(x, y, width, height).fill();
        }
        doc.restore();
      };

      // Helper function to wrap text to fit within maxWidth
      // Uses character-based approximation for better reliability
      const wrapText = (text: string, maxWidth: number, fontSize: number, font: string = 'Helvetica'): string[] => {
        if (!text) return [];
        doc.fontSize(fontSize).font(font);

        // Approximate character width based on font size
        // Helvetica at size 10: average char width is ~6px
        const avgCharWidth = fontSize * 0.6;
        const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;

          // Check character count as primary check
          if (testLine.length <= maxCharsPerLine) {
            // Double-check with actual width measurement
            const width = doc.widthOfString(testLine);
            if (width < maxWidth) {
              currentLine = testLine;
            } else {
              if (currentLine) {
                lines.push(currentLine);
              }
              currentLine = word;
            }
          } else {
            if (currentLine) {
              lines.push(currentLine);
            }
            currentLine = word;
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      };

      // Helper function to get text height for wrapped text
      const getTextHeight = (lines: string[], fontSize: number, lineHeight: number = 1.3): number => {
        if (lines.length === 0) return 0;
        return lines.length * fontSize * lineHeight;
      };

      // ===== HEADER SECTION WITH COLORED BACKGROUND =====
      // Calculate dynamic header height based on clinic info
      let headerHeight = 90; // Base height
      const clinicNameLines = invoiceData.clinic.name ? wrapText(invoiceData.clinic.name, 200, 10) : [];
      const clinicAddressLines = invoiceData.clinic.address ? wrapText(invoiceData.clinic.address, 200, 10) : [];
      const clinicContactHeight = invoiceData.clinic.contact_number ? 13 : 0;

      headerHeight += getTextHeight(clinicNameLines, 10);
      headerHeight += getTextHeight(clinicAddressLines, 10);
      headerHeight += clinicContactHeight;
      headerHeight = Math.max(headerHeight, 110); // Minimum height

      drawBox(0, 0, 595, headerHeight, '#eff6ff'); // Light blue background

      // Add logo
      const logoPath = path.join(process.cwd(), 'public', 'logo', 'cross.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 20, { width: 60, height: 60 });
      }

      // Find My Doctor branding
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#1b5eb8').text('Find My Doctor', 110, 25);

      // Clinic information with text wrapping
      doc.fontSize(10).font('Helvetica').fillColor('#475569');
      let clinicY = 55;

      if (invoiceData.clinic.name) {
        const nameLines = wrapText(invoiceData.clinic.name, 200, 10);
        nameLines.forEach((line) => {
          doc.text(line, 110, clinicY);
          clinicY += 13;
        });
      }

      if (invoiceData.clinic.address) {
        const addressLines = wrapText(invoiceData.clinic.address, 200, 10);
        addressLines.forEach((line) => {
          doc.text(line, 110, clinicY);
          clinicY += 13;
        });
      }

      if (invoiceData.clinic.contact_number) {
        doc.text(`Contact: ${invoiceData.clinic.contact_number}`, 110, clinicY);
        clinicY += 13;
      }

      // Invoice title and number (right aligned)
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e293b').text('INVOICE', 500, 25, { align: 'right' });
      doc.fontSize(11).font('Helvetica').fillColor('#64748b').text(`Invoice #: ${invoiceData.invoice_number}`, 500, 50, { align: 'right' });
      doc.text(`Date: ${formatDate(invoiceData.invoice_date)}`, 500, 65, { align: 'right' });

      // PAID status badge
      doc.save();
      doc.fillColor('#059669');
      doc.roundedRect(420, 80, 135, 20, 3).fill();
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#ffffff').text('PAID', 460, 84, { align: 'center' });
      doc.restore();

      // ===== INFORMATION BOXES SECTION =====
      const infoBoxY = headerHeight + 20;

      // Calculate invoice details box height
      let invoiceDetailsLines = 4; // Base lines
      if (invoiceData.doctor.specialty) invoiceDetailsLines++;
      if (invoiceData.doctor.practice_name) invoiceDetailsLines++;
      const invoiceDetailsHeight = 20 + (invoiceDetailsLines * 11.7);

      // Calculate patient details box height
      let patientDetailsLines = 1; // Name
      if (invoiceData.patient.email) patientDetailsLines++;
      if (invoiceData.patient.phone) patientDetailsLines++;
      const patientAddressLines = invoiceData.patient.address ? wrapText(invoiceData.patient.address, 200, 9) : [];
      patientDetailsLines += patientAddressLines.length;
      const patientDetailsHeight = 20 + (patientDetailsLines * 11.7);

      // Use the taller box for both to keep them aligned
      const infoBoxHeight = Math.max(invoiceDetailsHeight, patientDetailsHeight, 120);

      // Invoice Details Box (left)
      drawBox(40, infoBoxY, 250, infoBoxHeight, '#f8fafc', '#e2e8f0');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('Invoice Details', 50, infoBoxY + 12);
      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      let invoiceDetailsY = infoBoxY + 30;
      doc.text(`Invoice #: ${invoiceData.invoice_number}`, 50, invoiceDetailsY);
      invoiceDetailsY += 11.7;
      doc.text(`Date: ${formatDate(invoiceData.invoice_date)}`, 50, invoiceDetailsY);
      invoiceDetailsY += 11.7;
      doc.text(`Payment Method: ${invoiceData.payment.payment_method}`, 50, invoiceDetailsY);

      // Doctor information
      invoiceDetailsY += 11.7;
      doc.text('Doctor:', 50, invoiceDetailsY, { continued: true }).font('Helvetica-Bold').text(` ${invoiceData.doctor.first_name} ${invoiceData.doctor.last_name}`);
      invoiceDetailsY += 11.7;
      doc.font('Helvetica');
      if (invoiceData.doctor.specialty) {
        doc.text(`Specialty: ${invoiceData.doctor.specialty}`, 50, invoiceDetailsY);
        invoiceDetailsY += 11.7;
      }
      if (invoiceData.doctor.practice_name) {
        doc.text(`Practice: ${invoiceData.doctor.practice_name}`, 50, invoiceDetailsY);
      }

      // Patient Details Box (right)
      drawBox(305, infoBoxY, 250, infoBoxHeight, '#f8fafc', '#e2e8f0');
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text('Patient Details', 315, infoBoxY + 12);
      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      let patientDetailsY = infoBoxY + 30;
      doc.text(`${invoiceData.patient.first_name} ${invoiceData.patient.last_name}`, 315, patientDetailsY);
      patientDetailsY += 11.7;
      if (invoiceData.patient.email) {
        doc.text(`Email: ${invoiceData.patient.email}`, 315, patientDetailsY);
        patientDetailsY += 11.7;
      }
      if (invoiceData.patient.phone) {
        doc.text(`Phone: ${invoiceData.patient.phone}`, 315, patientDetailsY);
        patientDetailsY += 11.7;
      }
      if (invoiceData.patient.address) {
        const addressLines = wrapText(invoiceData.patient.address, 200, 9);
        addressLines.forEach((line) => {
          doc.text(line, 315, patientDetailsY);
          patientDetailsY += 11.7;
        });
      }

      // ===== CHARGES TABLE =====
      const tableY = infoBoxY + infoBoxHeight + 25;

      // Table header background
      drawBox(40, tableY, 515, 30, '#eff6ff', '#e2e8f0');

      // Table header
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Description', 50, tableY + 10);
      doc.text('Qty', 350, tableY + 10, { width: 45, align: 'center' });
      doc.text('Rate', 395, tableY + 10, { width: 70, align: 'right' });
      doc.text('Amount', 465, tableY + 10, { width: 80, align: 'right' });

      // Table border
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, tableY + 30).lineTo(555, tableY + 30).stroke();

      let rowY = tableY + 30;
      let rowNumber = 0;

      // Helper function to draw a row with dynamic height for text wrapping
      const drawRow = (description: string, qty: string, rate: string, amount: string, isHeader: boolean = false) => {
        // Wrap description text if it's too long
        const descriptionLines = wrapText(description, 290, 9);
        const textHeight = getTextHeight(descriptionLines, 9);
        const rowHeight = Math.max(25, textHeight);

        // Alternating row colors
        if (!isHeader && rowNumber % 2 === 1) {
          drawBox(40, rowY, 515, rowHeight, '#f8fafc');
        }

        doc.fontSize(9).font('Helvetica').fillColor('#334155');

        // Draw wrapped description
        descriptionLines.forEach((line, index) => {
          doc.text(line, 50, rowY + 8 + (index * 11.7));
        });

        // Draw qty, rate, amount vertically centered in the row
        const verticalOffset = (rowHeight - 11.7) / 2;
        doc.text(qty, 350, rowY + 8 + verticalOffset, { width: 45, align: 'center' });
        doc.text(rate, 395, rowY + 8 + verticalOffset, { width: 70, align: 'right' });
        doc.text(amount, 465, rowY + 8 + verticalOffset, { width: 80, align: 'right' });

        rowY += rowHeight;
        rowNumber++;
      };

      drawRow('Consultation Fee', '1', formatCurrency(invoiceData.payment.consultation_amount), formatCurrency(invoiceData.payment.consultation_amount));

      // Additional charges
      if (invoiceData.charges && invoiceData.charges.length > 0) {
        invoiceData.charges.forEach((charge) => {
          const description = charge.description || 'Additional Charge';

          if (charge.charge_type === 'MEDICINE') {
            const quantity = charge.quantity || 1;
            const unitPrice = charge.unit_price || charge.amount;
            drawRow(description, quantity.toString(), formatCurrency(unitPrice), formatCurrency(charge.amount));
          } else {
            drawRow(description, '-', '-', formatCurrency(charge.amount));
          }
        });
      }

      // Table bottom border
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, rowY).lineTo(555, rowY).stroke();

      // ===== TOTALS SECTION =====
      const totalsY = rowY + 25;

      // Calculate dynamic totals box height based on payment breakdown
      let paymentLines = 2; // Subtotal and header
      if (invoiceData.payment.advance_payment > 0) {
        paymentLines += 1;
        if (invoiceData.payment.amount_applied > 0) paymentLines += 1;
      }
      if (invoiceData.payment.cash_tendered > 0) paymentLines += 1;
      if (invoiceData.payment.change_amount > 0) paymentLines += 2; // Extra for separator line
      paymentLines += 2; // Total paid and separator
      if (invoiceData.payment.final_balance > 0) paymentLines += 1;

      const totalsBoxHeight = 25 + (paymentLines * 15) + 10; // Base + lines + padding

      // Totals box
      drawBox(305, totalsY, 250, totalsBoxHeight, '#f8fafc', '#e2e8f0');

      // Subtotal
      doc.fontSize(10).font('Helvetica').fillColor('#64748b');
      doc.text('Subtotal:', 315, totalsY + 15);
      doc.text(formatCurrency(invoiceData.payment.subtotal), 455, totalsY + 15, { width: 80, align: 'right' });

      // Payment breakdown separator
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(315, totalsY + 35).lineTo(555, totalsY + 35).stroke();

      // Payment breakdown section header
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('PAYMENT BREAKDOWN', 315, totalsY + 45);

      let paymentY = totalsY + 60;

      // Advance payment (if any)
      if (invoiceData.payment.advance_payment > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155');
        doc.text('GCash Advance:', 315, paymentY);
        doc.text(formatCurrency(invoiceData.payment.advance_payment), 455, paymentY, { width: 80, align: 'right' });
        paymentY += 15;

        if (invoiceData.payment.amount_applied > 0) {
          doc.fontSize(9).font('Helvetica').fillColor('#64748b');
          doc.text('  Applied to balance:', 315, paymentY);
          doc.text(formatCurrency(invoiceData.payment.amount_applied), 455, paymentY, { width: 80, align: 'right' });
          paymentY += 15;
        }
      }

      // Cash tendered (if any)
      if (invoiceData.payment.cash_tendered > 0) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155');
        doc.text('Cash Payment:', 315, paymentY);
        doc.text(formatCurrency(invoiceData.payment.cash_tendered), 455, paymentY, { width: 80, align: 'right' });
        paymentY += 15;
      }

      // Change (if any) - shown prominently in green
      if (invoiceData.payment.change_amount > 0) {
        doc.strokeColor('#d1fae5').lineWidth(0.5).moveTo(315, paymentY + 5).lineTo(555, paymentY + 5).stroke();
        paymentY += 10;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#059669');
        doc.text('Change Returned:', 315, paymentY);
        doc.text(formatCurrency(invoiceData.payment.change_amount), 455, paymentY, { width: 80, align: 'right' });
        paymentY += 15;
      }

      // Total paid separator
      doc.strokeColor('#1b5eb8').lineWidth(1).moveTo(315, paymentY + 5).lineTo(555, paymentY + 5).stroke();
      paymentY += 10;

      // Total paid
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1b5eb8');
      doc.text('TOTAL PAID:', 315, paymentY);
      doc.text(formatCurrency(invoiceData.payment.advance_payment + invoiceData.payment.cash_tendered), 455, paymentY, { width: 80, align: 'right' });

      // Final balance (if any)
      if (invoiceData.payment.final_balance > 0) {
        paymentY += 15;
        doc.fontSize(10).font('Helvetica').fillColor('#dc2626');
        doc.text('Remaining Balance:', 315, paymentY);
        doc.text(formatCurrency(invoiceData.payment.final_balance), 455, paymentY, { width: 80, align: 'right' });
      }

      // ===== FOOTER =====
      // Calculate dynamic footer position
      const contentEndY = paymentY + 20;
      const footerY = Math.max(contentEndY, 740);
      const footerHeight = 52;

      // Footer background
      drawBox(0, footerY, 595, footerHeight, '#f1f5f9');

      // Footer content
      doc.fontSize(9).font('Helvetica').fillColor('#64748b');
      if (invoiceData.clinic.footer_line) {
        doc.text(invoiceData.clinic.footer_line, { align: 'center' });
      }
      doc.moveDown(0.5);
      doc.text('This is a computer-generated invoice. For questions, please contact the clinic.', { align: 'center' });
      doc.moveDown(0.3);
      doc.text(`Contact: ${invoiceData.clinic.contact_number || 'N/A'}`, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
