import { Router } from 'express'
import ColumnController from '@controllers/ColumnController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { ColumnDTOSchema } from '@dtos/ColumnDTO.js'
import { ColumnEditDTOSchema } from '@dtos/ColumnEditDTO.js'
import { ColumnEditManyDTOSchema } from '@dtos/ColumnEditManyDTO.js'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.js'
import { ColumnMoveDTOSchema } from '@/application/dtos/ColumnMoveDTO.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'

interface IColumnRawController extends ColumnController {}

export default (controller: IColumnRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)

  router.post('/', postEntitiesLimiter, validationMiddleware(ColumnDTOSchema), controller.create)
  router.patch(
    '/move',
    patchEntitiesLimiter,
    validationMiddleware(ColumnMoveDTOSchema),
    controller.move,
  )
  router.patch(
    '/bulk',
    patchEntitiesLimiter,
    validationMiddleware(ColumnEditManyDTOSchema),
    controller.updateMany,
  )
  router.patch('/:id', validationMiddleware(ColumnEditDTOSchema), controller.update)
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', patchEntitiesLimiter, controller.archive)
  router.patch('/:id/recover', patchEntitiesLimiter, controller.recover)
  router.post('/:id/clone', postEntitiesLimiter, controller.clone)

  return router
}
