import { Router } from 'express'
import { YandexTrackerController } from '@controllers/YandexTrackerController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { YandexTrackerImportDTOSchema } from '@dtos/YandexTrackerImportDTO.js'
import { YandexTrackerConnectDTOSchema } from '@dtos/YandexTrackerConnectDTO.js'
import { postEntitiesLimiter, socialAuthLimiter } from '@/limiters.js'

export default (controller: YandexTrackerController): Router => {
  const router = Router()

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.post(
    '/connect',
    socialAuthLimiter,
    validationMiddleware(YandexTrackerConnectDTOSchema),
    controller.connect,
  )
  router.get('/boards', controller.getBoards)
  router.post(
    '/import',
    postEntitiesLimiter,
    validationMiddleware(YandexTrackerImportDTOSchema),
    controller.importBoard,
  )

  return router
}
