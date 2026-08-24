import { invoiceService } from '../services/invoice-service';
import prisma from '../utils/prisma';
import { InvoiceStatus } from '@prisma/client';
import { createTestInvoice, setupTestDb } from './test-helpers';

setupTestDb();

// ==================== CREATE ====================
describe('Create Invoice', () => {
  it('should create a draft invoice with items', async () => {
    const invoice = await createTestInvoice();

    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(invoice.customerName).toBe('Test Customer');
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{8}-\d{4}$/);
    expect(invoice.totalAmount).toBe(250000);
    expect(invoice.items).toHaveLength(2);
    expect(invoice.issuedAt).toBeNull();
  });

  it('should auto-calculate totalAmount from items', async () => {
    const invoice = await invoiceService.create({
      customerName: 'Calc Test',
      items: [
        { description: 'Item 1', quantity: 3, unitPrice: 200000 },
      ],
    });

    expect(invoice.totalAmount).toBe(600000);
    expect(invoice.items[0].amount).toBe(600000);
  });
});

// ==================== READ ====================
describe('Read Invoice', () => {
  it('should find invoice by ID', async () => {
    const created = await createTestInvoice();
    const found = await invoiceService.findById(created.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.items).toHaveLength(2);
  });

  it('should return null for non-existent ID', async () => {
    const found = await invoiceService.findById(99999);
    expect(found).toBeNull();
  });

  it('should list all invoices', async () => {
    await createTestInvoice();
    await createTestInvoice();
    const invoices = await invoiceService.findAll();
    expect(invoices).toHaveLength(2);
  });

  it('should filter invoices by status', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);

    const drafts = await invoiceService.findAll(InvoiceStatus.DRAFT);
    const issued = await invoiceService.findAll(InvoiceStatus.ISSUED);

    expect(drafts).toHaveLength(0);
    expect(issued).toHaveLength(1);
  });
});

// ==================== UPDATE ====================
describe('Update Invoice', () => {
  it('should update a DRAFT invoice', async () => {
    const invoice = await createTestInvoice();
    const updated = await invoiceService.update(invoice.id, {
      customerName: 'Updated Name',
    });

    expect(updated.customerName).toBe('Updated Name');
  });

  it('should update items and recalculate total', async () => {
    const invoice = await createTestInvoice();
    const updated = await invoiceService.update(invoice.id, {
      items: [{ description: 'New Item', quantity: 5, unitPrice: 100000 }],
    });

    expect(updated.items).toHaveLength(1);
    expect(updated.totalAmount).toBe(500000);
  });

  it('should reject update on ISSUED invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);

    await expect(
      invoiceService.update(invoice.id, { customerName: 'Fail' })
    ).rejects.toThrow('Only DRAFT invoices can be updated');
  });

  it('should throw error for non-existent invoice', async () => {
    await expect(
      invoiceService.update(99999, { customerName: 'Fail' })
    ).rejects.toThrow('Invoice not found');
  });
});

// ==================== DELETE ====================
describe('Delete Invoice', () => {
  it('should delete a DRAFT invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.delete(invoice.id);

    const found = await invoiceService.findById(invoice.id);
    expect(found).toBeNull();
  });

  it('should reject delete on ISSUED invoice', async () => {
    const invoice = await createTestInvoice();
    await invoiceService.issue(invoice.id);

    await expect(
      invoiceService.delete(invoice.id)
    ).rejects.toThrow('Only DRAFT invoices can be deleted');
  });
});