import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { OperationLogController } from '@controllers/OperationLogController.js'
import { patchEntitiesLimiter } from '@/limiters.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'

export default (controller: OperationLogController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/:id', controller.getById)
  router.patch('/:id/undo', patchEntitiesLimiter, controller.undoOperations)

  return router
}
