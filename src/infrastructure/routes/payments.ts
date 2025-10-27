import express from 'express';
import PaymentController from "../Controllers/Payment.ts";

const router = express.Router()

router
  .post('/premium', PaymentController.buyPremium)
  .post('/check', PaymentController.checkPayment)
  .delete('/autopayment', PaymentController.cancelAutoPayment)
  .get('/', PaymentController.getUserActivatedPayments)

export default router;