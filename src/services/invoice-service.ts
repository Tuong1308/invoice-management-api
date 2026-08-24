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

// Tao invoice number tu dong: INV-YYYYMMDD-XXXX
function generateInvoiceNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${date}-${random}`;
}

// Tinh tong tien tu items
function calculateTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export const invoiceService = {
  // Tao hoa don nhap (DRAFT)
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

  // Lay danh sach hoa don (co filter theo status)
  async findAll(status?: InvoiceStatus) {
    return prisma.invoice.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Lay chi tiet hoa don theo ID
  async findById(id: number) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
  },

  // Cap nhat hoa don nhap (chi DRAFT moi duoc sua)
  async update(id: number, data: UpdateInvoiceInput) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error('Only DRAFT invoices can be updated');
    }

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

  // Xoa hoa don nhap (chi DRAFT moi duoc xoa)
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
};