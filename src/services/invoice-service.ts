import prisma from '../utils/prisma';
import { InvoiceStatus } from '@prisma/client';

interface CreateInvoiceInput {
  customerName: string;
  customerAddress?: string;
  customerEmail?: string;
  note?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

interface UpdateInvoiceInput {
  customerName?: string;
  customerAddress?: string;
  customerEmail?: string;
  note?: string;
  items?: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
}

// Auto-generate invoice number: INV-YYYYMMDD-XXXX
function generateInvoiceNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${date}-${random}`;
}

// Calculate total amount from items
function calculateTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export const invoiceService = {
  // Create draft invoice
  async create(data: CreateInvoiceInput) {
    const totalAmount = calculateTotal(data.items);

    return prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        status: InvoiceStatus.DRAFT,
        customerName: data.customerName,
        customerAddress: data.customerAddress,
        customerEmail: data.customerEmail,
        note: data.note,
        totalAmount,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });
  },

  // Get all invoices (optional filter by status)
  async findAll(status?: InvoiceStatus) {
    return prisma.invoice.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Get invoice by ID
  async findById(id: number) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
  },

  // Update draft invoice (only DRAFT can be updated)
  async update(id: number, data: UpdateInvoiceInput) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only DRAFT invoices can be updated');
    }

    // If new items provided, delete old and create new
    const updateData: any = {
      customerName: data.customerName,
      customerAddress: data.customerAddress,
      customerEmail: data.customerEmail,
      note: data.note,
    };

    if (data.items) {
      updateData.totalAmount = calculateTotal(data.items);
      updateData.items = {
        deleteMany: {},
        create: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
        })),
      };
    }

    return prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { items: true },
    });
  },

  // Delete draft invoice (only DRAFT can be deleted)
  async delete(id: number) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only DRAFT invoices can be deleted');
    }

    return prisma.invoice.delete({ where: { id } });
  },

  // Issue invoice (DRAFT -> ISSUED)
  async issue(id: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only DRAFT invoices can be issued');
    }

    // Validate: must have at least one item
    if (!invoice.items || invoice.items.length === 0) {
      throw new Error('Invoice must have at least one item to be issued');
    }

    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
      },
      include: { items: true },
    });
  },

  // Cancel invoice (ISSUED -> CANCELED)
  async cancel(id: number, cancelReason: string) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new Error('Only ISSUED invoices can be canceled');
    }

    if (!cancelReason) {
      throw new Error('Cancel reason is required');
    }

    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELED,
        cancelReason,
        canceledAt: new Date(),
      },
      include: { items: true },
    });
  },

  // Replace invoice (ISSUED -> REPLACED + create new DRAFT)
  async replace(id: number) {
    const oldInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!oldInvoice) {
      throw new Error('Invoice not found');
    }

    if (oldInvoice.status !== InvoiceStatus.ISSUED) {
      throw new Error('Only ISSUED invoices can be replaced');
    }

    // Transaction: update old invoice + create new invoice
    const [_, newInvoice] = await prisma.$transaction([
      // 1. Old invoice -> REPLACED
      prisma.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.REPLACED },
      }),
      // 2. Create new invoice (DRAFT) referencing old invoice
      prisma.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          status: InvoiceStatus.DRAFT,
          customerName: oldInvoice.customerName,
          customerAddress: oldInvoice.customerAddress,
          customerEmail: oldInvoice.customerEmail,
          note: oldInvoice.note,
          totalAmount: oldInvoice.totalAmount,
          replacedInvoiceId: oldInvoice.id,
          items: {
            create: oldInvoice.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      }),
    ]);

    return newInvoice;
  },
};