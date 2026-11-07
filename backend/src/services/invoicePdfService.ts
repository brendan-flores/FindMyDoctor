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

      const formatMethodLabel = (method?: string | null): string => {
        if (!method) return '';
        if (method === 'CASH') return 'Cash';
        if (method === 'GCASH') return 'GCash';
        return method;
      };

      // Helper function to format date
      const formatDate = (date: string | Date): string => {
        const d = new Date(date);
        return d.toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
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

      // ===== HEADER =====
      // A4 page is 595 points wide at 72 DPI
      // 40pt margins = 40 points each side
      // Usable width = 595 - 2*40 = 515 points
      const x = 40;
      const w = 515;
      let y = 32;

      // Logo - scaled up 1.3x
      const logoPath = path.join(process.cwd(), 'public', 'logo', 'cross.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, x, y, { width: 80, height: 80 });
      }

      // Branding - scaled up 1.3x
      doc.fontSize(26).font('Helvetica-Bold').fillColor('#1b5eb8').text('Find My Doctor', x + 90, y + 25);

      // Clinic info (left side) - scaled up 1.3x
      doc.fontSize(13).font('Helvetica').fillColor('#64748b');
      let cy = y + 65;
      if (invoiceData.clinic.name) {
        doc.text(invoiceData.clinic.name, x + 90, cy, { width: 260, ellipsis: true });
        cy += 17;
      }
      if (invoiceData.clinic.address) {
        doc.text(invoiceData.clinic.address, x + 90, cy, { width: 260, ellipsis: true });
        cy += 17;
      }
      if (invoiceData.clinic.contact_number) {
        doc.text(`Contact: ${invoiceData.clinic.contact_number}`, x + 90, cy, { width: 260, ellipsis: true });
        cy += 17;
      }

      // Invoice info (right side) - scaled up 1.3x
      // Right block aligned with right margin
      const rightEdge = x + w; // 555
      const rightBlockWidth = 160;
      const rightBlockX = rightEdge - rightBlockWidth; // 555 - 160 = 395

      doc.fontSize(21).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text('INVOICE', rightBlockX, y + 25, { align: 'right', width: rightBlockWidth });

      doc.fontSize(13).font('Helvetica').fillColor('#64748b');
      doc.text(`Invoice #: ${invoiceData.invoice_number}`, rightBlockX, y + 52, { align: 'right', width: rightBlockWidth });
      doc.text(`Date: ${formatDate(invoiceData.invoice_date)}`, rightBlockX, y + 72, { align: 'right', width: rightBlockWidth });
      if (invoiceData.replaces_invoice_number) {
        doc.fontSize(11).font('Helvetica-Oblique').fillColor('#64748b');
        doc.text(`Replaces ${invoiceData.replaces_invoice_number}`, rightBlockX, y + 90, { align: 'right', width: rightBlockWidth });
      }

      // ===== BILL TO =====
      y = Math.max(cy + 26, y + 104);
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text('Bill To:', x, y);
      doc.fontSize(13).font('Helvetica').fillColor('#64748b');
      y += 20;
      doc.text(`${invoiceData.patient.first_name} ${invoiceData.patient.last_name}`, x, y);
      y += 17;
      if (invoiceData.patient.email) {
        doc.text(`Email: ${invoiceData.patient.email}`, x, y);
        y += 17;
      }
      if (invoiceData.patient.phone) {
        doc.text(`Phone: ${invoiceData.patient.phone}`, x, y);
        y += 17;
      }
      if (invoiceData.patient.address) {
        const lines = wrapText(invoiceData.patient.address, 350, 13);
        lines.forEach((line) => {
          doc.text(`Address: ${line}`, x, y);
          y += 17;
        });
      }

      // Separator - scaled up 1.3x
      y += 26;
      doc.strokeColor('#e2e8f0').lineWidth(0.65).moveTo(x, y).lineTo(x + w, y).stroke();
      y += 26;

      // ===== TABLE =====
      // Column widths based on percentages: Description 40%, Qty 10%, Rate 25%, Amount 25%
      // 515pt * 0.40 = 206pt, 515pt * 0.10 = 51.5pt, 515pt * 0.25 = 128.75pt
      const descWidth = 206;
      const qtyWidth = 52;
      const rateWidth = 129;
      const amountWidth = 129;

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text('Description', x, y);
      doc.text('Qty', x + descWidth, y, { width: qtyWidth, align: 'center' });
      doc.text('Rate', x + descWidth + qtyWidth, y, { width: rateWidth, align: 'right' });
      doc.text('Amount', x + descWidth + qtyWidth + rateWidth, y, { width: amountWidth, align: 'right' });

      y += 16;
      doc.strokeColor('#e2e8f0').lineWidth(0.65).moveTo(x, y).lineTo(x + w, y).stroke();
      y += 13;

      const drawRow = (desc: string, qty: string, rate: string, amt: string) => {
        const lines = wrapText(desc, descWidth - 10, 13);
        const height = Math.max(31, lines.length * 16);

        doc.fontSize(13).font('Helvetica').fillColor('#334155');
        lines.forEach((line, i) => doc.text(line, x, y + 10 + (i * 16)));

        const ry = y + 10;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#334155');
        doc.text(qty, x + descWidth, ry, { width: qtyWidth, align: 'center' });
        doc.text(rate, x + descWidth + qtyWidth, ry, { width: rateWidth, align: 'right' });
        doc.text(amt, x + descWidth + qtyWidth + rateWidth, ry, { width: amountWidth, align: 'right' });

        y += height;
        doc.strokeColor('#f1f5f9').lineWidth(0.65).moveTo(x, y).lineTo(x + w, y).stroke();
        y += 13;
      };

      drawRow('Consultation Fee', '1', formatCurrency(invoiceData.payment.consultation_amount), formatCurrency(invoiceData.payment.consultation_amount));

      if (invoiceData.charges?.length) {
        invoiceData.charges.forEach((charge) => {
          const desc = charge.description || 'Additional Charge';
          if (charge.quantity != null && charge.unit_price != null) {
            const qty = charge.quantity || 1;
            const price = charge.unit_price || charge.amount;
            drawRow(desc, qty.toString(), formatCurrency(price), formatCurrency(charge.amount));
          } else {
            drawRow(desc, '-', '-', formatCurrency(charge.amount));
          }
        });
      }

      // ===== TOTALS =====
      y += 26;
      // Label takes 75% (descWidth + qtyWidth + rateWidth = 206 + 52 + 129 = 387), value takes 25% (amountWidth = 129)
      const labelWidth = descWidth + qtyWidth + rateWidth;
      const valueWidth = amountWidth;
      
      doc.fontSize(13).font('Helvetica').fillColor('#475569');
      doc.text('Subtotal:', x, y);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#475569');
      doc.text(formatCurrency(invoiceData.payment.subtotal), x + labelWidth, y, { width: valueWidth, align: 'right' });
      y += 20;

      doc.strokeColor('#e2e8f0').lineWidth(0.65).moveTo(x, y).lineTo(x + w, y).stroke();
      y += 20;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#64748b').text('Payment Breakdown', x, y);
      y += 20;

      const acceptedTransactions = (invoiceData.payment.transactions || [])
        .filter(tx => tx.status === 'ACCEPTED');

      // Group Cash and GCash payments by method, sum amounts, list GCash refs.
      // Refunds are separate negative lines by method; TOTAL PAID is the sum
      // of every line (i.e. payments minus refunds).
      let cashTotal = 0.0;
      let gcashTotal = 0.0;
      let cashRefund = 0.0;
      let gcashRefund = 0.0;
      const finalGcashRefs: string[] = [];
      let totalPaid = 0.0;

      for (const tx of acceptedTransactions) {
        const amount = Number(tx.amount) || 0;
        const kind = tx.kind || '';
        const method = tx.method || '';

        if (kind === 'REFUND') {
          totalPaid -= amount;
          if (method === 'CASH') cashRefund += amount;
          else if (method === 'GCASH') gcashRefund += amount;
          continue;
        }

        // Kind === 'PAYMENT'
        totalPaid += amount;
        if (method === 'CASH') {
          cashTotal += amount;
        } else if (method === 'GCASH') {
          gcashTotal += amount;
          if (tx.reference_no) finalGcashRefs.push(tx.reference_no);
        }
      }

      // Cash line
      drawBox(x, y, w, 35, '#f8fafc', '#e2e8f0');
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Cash', x + 13, y + 12, { width: w - 140, ellipsis: true });
      doc.text(formatCurrency(cashTotal), x + labelWidth, y + 12, { width: valueWidth, align: 'right' });
      y += 35;

      // GCash line
      if (gcashTotal > 0 || finalGcashRefs.length > 0) {
        drawBox(x, y, w, 35, '#f8fafc', '#e2e8f0');
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b');
        finalGcashRefs.sort();
        const refsText = finalGcashRefs.length > 0 ? finalGcashRefs.join(', ') : '';
        doc.text('GCash · Ref: ' + refsText, x + 13, y + 12, { width: w - 140, ellipsis: true });
        doc.text(formatCurrency(gcashTotal), x + labelWidth, y + 12, { width: valueWidth, align: 'right' });
        y += 35;
      }

      // Refund lines (negative amounts by method)
      if (cashRefund > 0) {
        drawBox(x, y, w, 35, '#fef2f2', '#fecaca');
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#b91c1c');
        doc.text('Cash Refund', x + 13, y + 12, { width: w - 140, ellipsis: true });
        doc.text('-' + formatCurrency(cashRefund), x + labelWidth, y + 12, { width: valueWidth, align: 'right' });
        y += 35;
      }
      if (gcashRefund > 0) {
        drawBox(x, y, w, 35, '#fef2f2', '#fecaca');
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#b91c1c');
        doc.text('GCash Refund', x + 13, y + 12, { width: w - 140, ellipsis: true });
        doc.text('-' + formatCurrency(gcashRefund), x + labelWidth, y + 12, { width: valueWidth, align: 'right' });
        y += 35;
      }

      // Total Paid
      doc.strokeColor('#cbd5e1').lineWidth(0.65).moveTo(x, y + 10).lineTo(x + w, y + 10).stroke();
      y += 13;

      doc.fontSize(15).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text('TOTAL PAID:', x, y);
      doc.text(formatCurrency(totalPaid), x + labelWidth, y, { width: valueWidth, align: 'right' });
      y += 20;

      if (invoiceData.payment.final_balance > 0) {
        doc.fontSize(13).font('Helvetica').fillColor('#dc2626');
        doc.text('Remaining Balance:', x, y);
        doc.text(formatCurrency(invoiceData.payment.final_balance), x + labelWidth, y, { width: valueWidth, align: 'right' });
        y += 20;
      }

      // ===== FOOTER =====
      y += 35;
      doc.strokeColor('#e2e8f0').lineWidth(0.65).moveTo(x, y).lineTo(x + w, y).stroke();
      y += 35;

      doc.fontSize(13).font('Helvetica').fillColor('#64748b');
      if (invoiceData.clinic.footer_line) {
        doc.text(invoiceData.clinic.footer_line, x, y, { width: w, align: 'center' });
        y += 17;
      }
      doc.fontSize(12).font('Helvetica').fillColor('#94a3b8');
      doc.text('This is a computer-generated invoice.', x, y, { width: w, align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
