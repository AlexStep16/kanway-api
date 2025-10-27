import express from 'express';
import PaymentController from "../Controllers/Payment.ts";

const router = express.Router()

router
  .post('/', PaymentController.paymentNotification)

export default router;