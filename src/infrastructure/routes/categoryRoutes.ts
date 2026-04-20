import { Router } from 'express'
import CategoryController from '@controllers/CategoryController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { CategoryDTOSchema } from '@dtos/CategoryDTO.js'
import { CategoryEditDTOSchema } from '@dtos/CategoryEditDTO.js'
import { CategoryEditManyDTOSchema } from '@dtos/CategoryEditManyDTO.js'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.js'
import { CategoryMoveDTOSchema } from '@/application/dtos/CategoryMoveDTO.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'

interface ICategoryRawController extends CategoryController {}

export default (controller: ICategoryRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)

  router.post('/', postEntitiesLimiter, validationMiddleware(CategoryDTOSchema), controller.create)
  router.patch(
    '/move',
    patchEntitiesLimiter,
    validationMiddleware(CategoryMoveDTOSchema),
    controller.move,
  )
  router.patch(
    '/bulk',
    patchEntitiesLimiter,
    validationMiddleware(CategoryEditManyDTOSchema),
    controller.updateMany,
  )
  router.patch('/:id', validationMiddleware(CategoryEditDTOSchema), controller.update)
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', patchEntitiesLimiter, controller.archive)
  router.patch('/:id/recover', patchEntitiesLimiter, controller.recover)
  router.post('/:id/clone', postEntitiesLimiter, controller.clone)

  return router
}
