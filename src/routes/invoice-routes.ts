import { Router } from 'express';
import { invoiceController } from '../controllers/invoice-controller';

const router = Router();

// CRUD cơ bản
router.post('/', invoiceController.create);
router.get('/', invoiceController.findAll);
router.get('/:id', invoiceController.findById);
router.put('/:id', invoiceController.update);
router.delete('/:id', invoiceController.delete);

export default router;