import { invoiceService } from '../services/invoice-service';
import prisma from '../utils/prisma';
import { InvoiceStatus } from '@prisma/client';
import { createTestInvoice, setupTestDb } from './test-helpers';

setupTestDb();

// ==================== ISSUE ====================
describe('Issue Invoice', () => {
  it('should transition DRAFT to ISSUED', async () => {
    const invoice = await createTestInvoice();
    const issued = await invoiceService.issue(invoice.id);

    expect(issued.status).toBe(InvoiceStatus.ISSUED);
    expect(issued.issuedAt).not.toBeNull();
  });

  it('should reject issuing a non-DRAFT invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);

    await expect(
      invoiceService.issue(invoice.id)
    ).rejects.toThrow('Only DRAFT invoices can be issued');
  });

  it('should reject issuing invoice with no items', async () => {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-TEST-0001',
        status: InvoiceStatus.DRAFT,
        customerName: 'No Items',
        totalAmount: 0,
      },
    });

    await expect(
      invoiceService.issue(invoice.id)
    ).rejects.toThrow('Invoice must have at least one item to be issued');
  });
});

// ==================== CANCEL ====================
describe('Cancel Invoice', () => {
  it('should transition ISSUED to CANCELED with reason', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);
    const canceled = await invoiceService.cancel(invoice.id, 'Wrong amount');

    expect(canceled.status).toBe(InvoiceStatus.CANCELED);
    expect(canceled.cancelReason).toBe('Wrong amount');
    expect(canceled.canceledAt).not.toBeNull();
  });

  it('should reject canceling a DRAFT invoice', async () => {
    const invoice = await createTestInvoice();

    await expect(
      invoiceService.cancel(invoice.id, 'Test')
    ).rejects.toThrow('Only ISSUED invoices can be canceled');
  });

  it('should reject canceling without reason', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);

    await expect(
      invoiceService.cancel(invoice.id, '')
    ).rejects.toThrow('Cancel reason is required');
  });

  it('should reject canceling an already CANCELED invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);
    await invoiceService.cancel(invoice.id, 'First cancel');

    await expect(
      invoiceService.cancel(invoice.id, 'Second cancel')
    ).rejects.toThrow('Only ISSUED invoices can be canceled');
  });
});

// ==================== REPLACE ====================
describe('Replace Invoice', () => {
  it('should replace ISSUED invoice and create new DRAFT', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);
    const newInvoice = await invoiceService.replace(invoice.id);

    // New invoice should be DRAFT with reference to old
    expect(newInvoice.status).toBe(InvoiceStatus.DRAFT);
    expect(newInvoice.replacedInvoiceId).toBe(invoice.id);
    expect(newInvoice.customerName).toBe(invoice.customerName);
    expect(newInvoice.items).toHaveLength(2);

    // Old invoice should be REPLACED
    const oldInvoice = await invoiceService.findById(invoice.id);
    expect(oldInvoice!.status).toBe(InvoiceStatus.REPLACED);
  });

  it('should reject replacing a DRAFT invoice', async () => {
    const invoice = await createTestInvoice();

    await expect(
      invoiceService.replace(invoice.id)
    ).rejects.toThrow('Only ISSUED invoices can be replaced');
  });

  it('should reject replacing an already REPLACED invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);
    await invoiceService.replace(invoice.id);

    await expect(
      invoiceService.replace(invoice.id)
    ).rejects.toThrow('Only ISSUED invoices can be replaced');
  });

  it('should copy items from old invoice to new invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);
    const newInvoice = await invoiceService.replace(invoice.id);

    expect(newInvoice.items[0].description).toBe('Service A');
    expect(newInvoice.items[1].description).toBe('Service B');
    expect(newInvoice.totalAmount).toBe(invoice.totalAmount);
  });
});