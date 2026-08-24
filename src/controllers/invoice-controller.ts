import { Request, Response } from 'express';
import { invoiceService } from '../services/invoice-service';
import { InvoiceStatus } from '@prisma/client';

export const invoiceController = {
  // POST /api/invoices
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

  // GET /api/invoices
  async findAll(req: Request, res: Response) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status as InvoiceStatus : undefined;
      const invoices = await invoiceService.findAll(status);
      return res.json(invoices);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // GET /api/invoices/:id
  async findById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
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

  // PUT /api/invoices/:id
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
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

  // DELETE /api/invoices/:id
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt( req.params.id as string);
      if (isNaN(id)) {
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
};