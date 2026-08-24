import PDFDocument from 'pdfkit';
import { Invoice, InvoiceItem } from '@prisma/client';

type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

export function generateInvoicePDF(invoice: InvoiceWithItems): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // A4 = 595pt wide. Content: 50 to 540 = 490pt (extra 5pt right padding)
  const L = 50;
  const R = 540;
  const W = R - L; // 490

  const colors = {
    primary: '#2563eb',
    dark: '#111827',
    text: '#374151',
    gray: '#6b7280',
    lightGray: '#e5e7eb',
    rowAlt: '#f9fafb',
    white: '#ffffff',
    red: '#dc2626',
    green: '#059669',
    orange: '#d97706',
  };

  // Table column layout (must sum to W = 490)
  // | Description 200 | Unit Price 100 | Quantity 60 | Amount 130 |
  const tbl = {
    desc: { x: L,       w: 200 },
    unit: { x: L + 200, w: 100 },
    qty:  { x: L + 300, w: 60  },
    amt:  { x: L + 360, w: 130 },
  };
  // Verify: 200 + 100 + 60 + 130 = 490 = W ✓
  // Right padding inside cells
  const pad = 8;

  // ===================== HEADER =====================
  doc.fontSize(22).font('Helvetica-Bold').fillColor(colors.primary)
    .text('Invoice', L, 45);

  const metaLabelX = 320;
  const metaValW = R - metaLabelX - 80; // value area
  const metaValX = R - metaValW;

  doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
    .text('Invoice Number', metaLabelX, 45);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.dark)
    .text(invoice.invoiceNumber, metaValX, 45, { width: metaValW, align: 'right' });

  doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
    .text('Date', metaLabelX, 62);
  doc.fontSize(10).font('Helvetica').fillColor(colors.dark)
    .text(formatDate(invoice.createdAt), metaValX, 62, { width: metaValW, align: 'right' });

  let metaY = 79;
  if (invoice.issuedAt) {
    doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
      .text('Issued Date', metaLabelX, metaY);
    doc.fontSize(10).font('Helvetica').fillColor(colors.dark)
      .text(formatDate(invoice.issuedAt), metaValX, metaY, { width: metaValW, align: 'right' });
    metaY += 17;
  }

  doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
    .text('Status', metaLabelX, metaY);
  doc.fontSize(10).font('Helvetica-Bold').fillColor(getStatusColor(invoice.status, colors))
    .text(invoice.status, metaValX, metaY, { width: metaValW, align: 'right' });

  // ===================== DIVIDER =====================
  const divY = metaY + 25;
  doc.moveTo(L, divY).lineTo(R, divY).lineWidth(0.5).strokeColor(colors.lightGray).stroke();

  // ===================== BILL TO =====================
  const billY = divY + 15;
  doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.gray).text('BILL TO', L, billY);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.dark)
    .text(invoice.customerName, L, billY + 16);

  let cy = billY + 32;
  doc.fontSize(9).font('Helvetica').fillColor(colors.text);
  if (invoice.customerAddress) { doc.text(invoice.customerAddress, L, cy); cy += 14; }
  if (invoice.customerEmail)   { doc.text(invoice.customerEmail, L, cy);   cy += 14; }

  // ===================== ITEMS TABLE =====================
  const tableY = Math.max(cy + 20, billY + 65);

  // Header row
  doc.rect(L, tableY, W, 22).fill(colors.primary);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.white);
  doc.text('Description', tbl.desc.x + pad, tableY + 6, { width: tbl.desc.w - pad * 2 });
  doc.text('Unit Price',  tbl.unit.x,       tableY + 6, { width: tbl.unit.w - pad, align: 'right' });
  doc.text('Quantity',    tbl.qty.x,        tableY + 6, { width: tbl.qty.w - pad,  align: 'right' });
  doc.text('Amount',      tbl.amt.x,        tableY + 6, { width: tbl.amt.w - pad,  align: 'right' });

  // Data rows
  let y = tableY + 28;
  invoice.items.forEach((item, i) => {
    if (i % 2 === 0) {
      doc.rect(L, y - 5, W, 22).fill(colors.rowAlt);
    }
    doc.font('Helvetica').fontSize(9).fillColor(colors.dark);
    doc.text(item.description,                        tbl.desc.x + pad, y, { width: tbl.desc.w - pad * 2 });
    doc.text(formatCurrency(Number(item.unitPrice)),   tbl.unit.x,      y, { width: tbl.unit.w - pad, align: 'right' });
    doc.text(`${item.quantity}`,                       tbl.qty.x,       y, { width: tbl.qty.w - pad,  align: 'right' });
    doc.text(formatCurrency(Number(item.amount)),      tbl.amt.x,       y, { width: tbl.amt.w - pad,  align: 'right' });
    y += 22;
  });

  // Bottom border
  doc.moveTo(L, y - 3).lineTo(R, y - 3).lineWidth(0.5).strokeColor(colors.lightGray).stroke();

  // ===================== TOTALS =====================
  y += 12;
  const totLblW = 80;
  const totValW = tbl.amt.w - pad;
  const totLblX = tbl.amt.x - totLblW;
  const totValX = tbl.amt.x;

  doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
    .text('Subtotal', totLblX, y, { width: totLblW, align: 'right' });
  doc.fillColor(colors.dark)
    .text(formatCurrency(Number(invoice.totalAmount)), totValX, y, { width: totValW, align: 'right' });

  y += 17;
  doc.fillColor(colors.gray)
    .text('Tax (0%)', totLblX, y, { width: totLblW, align: 'right' });
  doc.fillColor(colors.dark)
    .text(formatCurrency(0), totValX, y, { width: totValW, align: 'right' });

  y += 17;
  doc.moveTo(totLblX, y).lineTo(R, y).lineWidth(0.5).strokeColor(colors.lightGray).stroke();

  y += 8;
  doc.fontSize(11).font('Helvetica-Bold').fillColor(colors.dark)
    .text('Total', totLblX, y, { width: totLblW, align: 'right' });
  doc.fillColor(colors.primary)
    .text(formatCurrency(Number(invoice.totalAmount)), totValX, y, { width: totValW, align: 'right' });

  // ===================== NOTES =====================
  y += 40;
  if (invoice.note) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(colors.gray).text('NOTES', L, y);
    y += 14;
    doc.fontSize(9).font('Helvetica').fillColor(colors.text)
      .text(invoice.note, L, y, { width: 300 });
    y += 25;
  }

  // ===================== CANCEL INFO =====================
  if (invoice.cancelReason) {
    y += 10;
    doc.roundedRect(L, y, W, 45, 4).lineWidth(1).strokeColor(colors.red).stroke();
    doc.fontSize(10).font('Helvetica-Bold').fillColor(colors.red)
      .text('CANCELED', L + 15, y + 8);
    doc.fontSize(9).font('Helvetica').fillColor(colors.text)
      .text(`Reason: ${invoice.cancelReason}`, L + 15, y + 22);
    if (invoice.canceledAt) {
      doc.text(`Date: ${formatDate(invoice.canceledAt)}`, L + 15, y + 34);
    }
    y += 55;
  }

  // ===================== REPLACE INFO =====================
  if (invoice.replacedInvoiceId) {
    y += 5;
    doc.fontSize(9).font('Helvetica').fillColor(colors.gray)
      .text(`This invoice replaces invoice #${invoice.replacedInvoiceId}`, L, y);
  }

  // ===================== FOOTER =====================
  doc.moveTo(L, 780).lineTo(R, 780).lineWidth(0.5).strokeColor(colors.lightGray).stroke();
  doc.fontSize(8).font('Helvetica').fillColor(colors.gray)
    .text('Thank you for your business!', L, 788, { width: W, align: 'center' });

  doc.end();
  return doc;
}

function getStatusColor(status: string, colors: Record<string, string>): string {
  switch (status) {
    case 'DRAFT':    return colors.gray;
    case 'ISSUED':   return colors.green;
    case 'CANCELED': return colors.red;
    case 'REPLACED': return colors.orange;
    default:         return colors.dark;
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' VND';
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}