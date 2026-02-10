import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.ts'
import { SettingController } from '@controllers/SettingController.ts'
import { SettingEditDTOSchema } from '@dtos/SettingEditDTO.ts'
import { patchEntitiesLimiter } from '@/limiters.ts'

export default (controller: SettingController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.get)
  router.patch(
    '/',
    patchEntitiesLimiter,
    validationMiddleware(SettingEditDTOSchema),
    controller.update,
  )

  return router
}
