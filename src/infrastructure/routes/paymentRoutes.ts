import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { PaymentController } from '@controllers/PaymentController.js'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.js'
import { BuySubscriptionDTOSchema } from '@/application/dtos/BuySubscriptionDTO.js'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.js'
import { BuyCreditsDTOSchema } from '@/application/dtos/BuyCreditsDTO.js'

export default (controller: PaymentController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.post(
    '/buy-subscription',
    postEntitiesLimiter,
    validationMiddleware(BuySubscriptionDTOSchema),
    controller.buySubscription,
  )
  router.post(
    '/buy-credits',
    postEntitiesLimiter,
    validationMiddleware(BuyCreditsDTOSchema),
    controller.buyCredits,
  )
  router.post(
    '/upgrade-subscription',
    postEntitiesLimiter,
    validationMiddleware(BuySubscriptionDTOSchema),
    controller.upgradeSubscription,
  )
  router.post(
    '/downgrade-subscription',
    postEntitiesLimiter,
    validationMiddleware(BuySubscriptionDTOSchema),
    controller.downgradeSubscription,
  )
  router.patch(
    '/downgrade-subscription/cancel',
    patchEntitiesLimiter,
    controller.downgradeCancelSubscription,
  )
  router.patch('/cancel-subscription', patchEntitiesLimiter, controller.cancelSubscription)
  router.patch('/resume-subscription', patchEntitiesLimiter, controller.resumeSubscription)

  return router
}
