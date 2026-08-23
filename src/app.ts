import express from "express";
import invoiceRouter from "./routes/invoice.routes";

const app = express();

app.use(express.json());
app.use("/api/invoices", invoiceRouter);

export default app;
