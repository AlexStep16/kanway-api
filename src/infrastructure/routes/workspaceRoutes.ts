import { Router } from 'express'
import WorkspaceController from '@controllers/WorkspaceController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.ts'
import { WorkspaceDTOSchema } from '@dtos/WorkspaceDTO.ts'
import { WorkspaceEditDTOSchema } from '@dtos/WorkspaceEditDTO.ts'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.ts'

interface IWorkspaceRawController extends WorkspaceController {}

export default (controller: IWorkspaceRawController): Router => {
  const router = Router()

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/count', controller.getCount)
  router.get('/:id', controller.getById)

  router.post('/', postEntitiesLimiter, validationMiddleware(WorkspaceDTOSchema), controller.create)
  router.patch(
    '/:id',
    patchEntitiesLimiter,
    validationMiddleware(WorkspaceEditDTOSchema),
    controller.update,
  )
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', patchEntitiesLimiter, controller.archive)
  router.patch('/:id/recover', patchEntitiesLimiter, controller.recover)
  router.post('/:id/clone', postEntitiesLimiter, controller.clone)

  return router
}
