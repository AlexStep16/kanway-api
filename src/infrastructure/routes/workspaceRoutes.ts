import { Router } from 'express'
import WorkspaceController from '@controllers/WorkspaceController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { WorkspaceDTOSchema } from '@dtos/WorkspaceDTO.js'
import { WorkspaceEditDTOSchema } from '@dtos/WorkspaceEditDTO.js'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.js'
import { WorkspaceMoveDTOSchema } from '@/application/dtos/WorkspaceMoveDTO.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'
import { WelcomeDTOSchema } from '@/application/dtos/WelcomeDTO.js'

interface IWorkspaceRawController extends WorkspaceController {}

export default (controller: IWorkspaceRawController): Router => {
  const router = Router()

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/', controller.getAll)
  router.get('/count', controller.getCount)
  router.get('/:id', controller.getById)

  router.post('/', postEntitiesLimiter, validationMiddleware(WorkspaceDTOSchema), controller.create)
  router.patch(
    '/move',
    patchEntitiesLimiter,
    validationMiddleware(WorkspaceMoveDTOSchema),
    controller.move,
  )
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
  router.post(
    '/welcome',
    postEntitiesLimiter,
    validationMiddleware(WelcomeDTOSchema),
    controller.welcome,
  )

  return router
}
