import { Router } from 'express'
import TaskController from '@controllers/TaskController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.ts'
import { TaskDTOSchema } from '@dtos/TaskDTO.ts'
import { TaskEditDTOSchema } from '@dtos/TaskEditDTO.ts'
import { TaskEditManyDTOSchema } from '@dtos/TaskEditManyDTO.ts'
import { patchTasksLimiter, postTasksLimiter } from '@/limiters.ts'

interface ITaskRawController extends TaskController {}

export default (controller: ITaskRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)

  router.post('/', postTasksLimiter, validationMiddleware(TaskDTOSchema), controller.create)
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
