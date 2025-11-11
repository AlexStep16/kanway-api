import { Router } from 'express'
import CategoryController from '@controllers/CategoryController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@middlewares/validationMiddleware.ts'
import { CategoryDTOSchema } from '@dtos/CategoryDTO.ts'
import { CategoryEditDTOSchema } from '@dtos/CategoryEditDTO.ts'
import { CategoryEditManyDTOSchema } from '@dtos/CategoryEditManyDTO.ts'

interface ICategoryRawController extends CategoryController {}

export default (controller: ICategoryRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)
  router.post('/', validationMiddleware(CategoryDTOSchema), controller.create)
  router.patch('/bulk', validationMiddleware(CategoryEditManyDTOSchema), controller.updateMany)
  router.patch('/:id', validationMiddleware(CategoryEditDTOSchema), controller.update)
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', controller.archive)
  router.patch('/:id/recover', controller.recover)
  router.post('/:id/clone', controller.clone)

  return router
}
