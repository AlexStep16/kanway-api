import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@middlewares/validationMiddleware.ts'
import { SettingController } from '@controllers/SettingController.ts'
import { SettingEditDTOSchema } from '@dtos/SettingEditDTO.ts'

export default (controller: SettingController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.get)
  router.patch('/', validationMiddleware(SettingEditDTOSchema), controller.update)

  return router
}
