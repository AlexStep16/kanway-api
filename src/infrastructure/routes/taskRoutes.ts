import { Router } from 'express'
import TaskController from '@controllers/TaskController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@middlewares/validationMiddleware.ts'
import { TaskDTOSchema } from '@dtos/TaskDTO.ts'
import { TaskEditDTOSchema } from '@dtos/TaskEditDTO.ts'

interface ITaskRawController extends TaskController {}

export default (controller: ITaskRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)
  router.post('/', validationMiddleware(TaskDTOSchema), controller.create)
  router.patch('/:id', validationMiddleware(TaskEditDTOSchema), controller.update)
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', controller.archive)
  router.patch('/:id/recover', controller.recover)

  return router
}
