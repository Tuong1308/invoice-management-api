import { invoiceService } from '../services/invoice-service';
import prisma from '../utils/prisma';

// Helper: create a draft invoice for testing
export async function createTestInvoice() {
  return invoiceService.create({
    customerName: 'Test Customer',
    customerAddress: '123 Test Street',
    customerEmail: 'test@example.com',
    note: 'Test note',
    items: [
      { description: 'Service A', quantity: 2, unitPrice: 100000 },
      { description: 'Service B', quantity: 1, unitPrice: 50000 },
    ],
  });
}

// Clean up database before each test
export function setupTestDb() {
  beforeEach(async () => {
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}