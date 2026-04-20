import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { SettingController } from '@controllers/SettingController.js'
import { SettingEditDTOSchema } from '@dtos/SettingEditDTO.js'
import { patchEntitiesLimiter } from '@/limiters.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'

export default (controller: SettingController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/', controller.get)
  router.patch(
    '/',
    patchEntitiesLimiter,
    validationMiddleware(SettingEditDTOSchema),
    controller.update,
  )

  return router
}
