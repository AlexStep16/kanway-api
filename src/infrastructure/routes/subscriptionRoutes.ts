import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { SubscriptionController } from '@controllers/SubscriptionController.ts'

export default (controller: SubscriptionController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)

  return router
}
