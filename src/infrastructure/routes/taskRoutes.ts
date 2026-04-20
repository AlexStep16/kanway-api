import { Router } from 'express'
import TaskController from '@controllers/TaskController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { TaskDTOSchema } from '@dtos/TaskDTO.js'
import { TaskEditDTOSchema } from '@dtos/TaskEditDTO.js'
import { TaskEditManyDTOSchema } from '@dtos/TaskEditManyDTO.js'
import { patchTasksLimiter, postTasksLimiter } from '@/limiters.js'
import { TaskMoveDTOSchema } from '@/application/dtos/TaskMoveDTO.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'

interface ITaskRawController extends TaskController {}

export default (controller: ITaskRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)

  router.post('/', postTasksLimiter, validationMiddleware(TaskDTOSchema), controller.create)
  router.patch('/move', patchTasksLimiter, validationMiddleware(TaskMoveDTOSchema), controller.move)
  router.patch(
    '/bulk',
    patchTasksLimiter,
    validationMiddleware(TaskEditManyDTOSchema),
    controller.updateMany,
  )
  router.patch(
    '/:id',
    patchTasksLimiter,
    validationMiddleware(TaskEditDTOSchema),
    controller.update,
  )
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', patchTasksLimiter, controller.archive)
  router.patch('/:id/recover', patchTasksLimiter, controller.recover)
  router.post('/:id/clone', postTasksLimiter, controller.clone)

  return router
}
