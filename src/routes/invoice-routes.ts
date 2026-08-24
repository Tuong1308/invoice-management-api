import { Router } from 'express';
import { invoiceController } from '../controllers/invoice-controller';

const router = Router();

// CRUD
router.post('/', invoiceController.create);
router.get('/', invoiceController.findAll);
router.get('/:id', invoiceController.findById);
router.put('/:id', invoiceController.update);
router.delete('/:id', invoiceController.delete);

// Business logic
router.patch('/:id/issue', invoiceController.issue);
router.patch('/:id/cancel', invoiceController.cancel);
router.post('/:id/replace', invoiceController.replace);

export default router;