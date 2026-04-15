import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { PaymentController } from '@controllers/PaymentController.js'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.js'
import { BuySubscriptionDTOSchema } from '@/application/dtos/BuySubscriptionDTO.js'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.js'

export default (controller: PaymentController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.post(
    '/buy',
    postEntitiesLimiter,
    validationMiddleware(BuySubscriptionDTOSchema),
    controller.buySubscription,
  )
  router.post(
    '/upgrade',
    postEntitiesLimiter,
    validationMiddleware(BuySubscriptionDTOSchema),
    controller.upgradeSubscription,
  )
  router.post(
    '/downgrade',
    postEntitiesLimiter,
    validationMiddleware(BuySubscriptionDTOSchema),
    controller.downgradeSubscription,
  )
  router.patch('/downgrade/cancel', patchEntitiesLimiter, controller.downgradeCancelSubscription)
  router.patch('/cancel', patchEntitiesLimiter, controller.cancelSubscription)
  router.patch('/resume', patchEntitiesLimiter, controller.resumeSubscription)

  return router
}
