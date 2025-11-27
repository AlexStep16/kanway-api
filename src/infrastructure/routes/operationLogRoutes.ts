import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { OperationLogController } from '@controllers/OperationLogController.ts'

export default (controller: OperationLogController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.patch('/:id/undo', controller.undoOperation)

  return router
}
