import { Request, Response } from 'express';
import { invoiceService } from '../services/invoice-service';
import { generateInvoicePDF } from '../services/pdf-service';
import { InvoiceStatus } from '@prisma/client';

function parseInvoiceId(value: string | string[]): number | null {
  if (Array.isArray(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const invoiceController = {
  // POST /api/invoices — Create draft invoice
  async create(req: Request, res: Response) {
    try {
      const { customerName, customerAddress, customerEmail, note, items } = req.body;

      if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'customerName and items are required' });
      }

      const invoice = await invoiceService.create({
        customerName,
        customerAddress,
        customerEmail,
        note,
        items,
      });

      return res.status(201).json(invoice);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /api/invoices — Get all invoices
  async findAll(req: Request, res: Response) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status as InvoiceStatus : undefined;
      const invoices = await invoiceService.findAll(status);
      return res.json(invoices);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /api/invoices/:id — Get invoice by ID
  async findById(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      const invoice = await invoiceService.findById(id);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      return res.json(invoice);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // PUT /api/invoices/:id — Update draft invoice
  async update(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      const invoice = await invoiceService.update(id, req.body);
      return res.json(invoice);
    } catch (error: any) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Only DRAFT invoices can be updated') {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  // DELETE /api/invoices/:id — Delete draft invoice
  async delete(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      await invoiceService.delete(id);
      return res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Only DRAFT invoices can be deleted') {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  // PATCH /api/invoices/:id/issue — Issue invoice (DRAFT -> ISSUED)
  async issue(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      const invoice = await invoiceService.issue(id);
      return res.json(invoice);
    } catch (error: any) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Only DRAFT') || error.message.includes('must have')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  // PATCH /api/invoices/:id/cancel — Cancel invoice (ISSUED -> CANCELED)
  async cancel(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      const { cancelReason } = req.body;
      const invoice = await invoiceService.cancel(id, cancelReason);
      return res.json(invoice);
    } catch (error: any) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Only ISSUED') || error.message.includes('reason')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  // POST /api/invoices/:id/replace — Replace invoice (ISSUED -> REPLACED + new DRAFT)
  async replace(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      const newInvoice = await invoiceService.replace(id);
      return res.status(201).json(newInvoice);
    } catch (error: any) {
      if (error.message === 'Invoice not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Only ISSUED')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /api/invoices/:id/pdf — Download invoice as PDF
  async downloadPDF(req: Request, res: Response) {
    try {
      const id = parseInvoiceId(req.params.id);
      if (id === null) {
        return res.status(400).json({ error: 'Invalid invoice ID' });
      }

      const invoice = await invoiceService.findById(id);

      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);

      const pdfDoc = generateInvoicePDF(invoice);
      pdfDoc.pipe(res);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },
};