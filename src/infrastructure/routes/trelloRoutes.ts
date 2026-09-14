import { Router } from 'express'
import { TrelloController } from '@controllers/TrelloController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { TrelloImportDTOSchema } from '@dtos/TrelloImportDTO.js'
import { postEntitiesLimiter } from '@/limiters.js'

export default (controller: TrelloController): Router => {
  const router = Router()

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/config', controller.getConfig)
  router.get('/boards', controller.getBoards)
  router.post(
    '/import',
    postEntitiesLimiter,
    validationMiddleware(TrelloImportDTOSchema),
    controller.importBoard,
  )

  return router
}
