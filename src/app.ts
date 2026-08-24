import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import invoiceRoutes from './routes/invoice-routes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/invoices', invoiceRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;