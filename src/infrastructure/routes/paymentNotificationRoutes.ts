import { Router } from 'express'
import { PaymentController } from '@controllers/PaymentController.js'

export default (controller: PaymentController): Router => {
  const router = Router({ mergeParams: true })

  router.post('/', controller.notifications)

  return router
}
