import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { PaymentMethodController } from '@controllers/PaymentMethodController.ts'

export default (controller: PaymentMethodController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.delete('/:id', controller.deleteById)

  return router
}
