import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { OperationLogController } from '@controllers/OperationLogController.js'
import { patchEntitiesLimiter } from '@/limiters.js'

export default (controller: OperationLogController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/:id', controller.getById)
  router.patch('/:id/undo', patchEntitiesLimiter, controller.undoOperations)

  return router
}
