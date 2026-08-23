import { Router } from "express";

const invoiceRouter = Router();

invoiceRouter.get("/", (_request, response) => {
  response.json([]);
});

export default invoiceRouter;
