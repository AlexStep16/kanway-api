import { Router } from 'express'
import BoardController from '@controllers/BoardController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.ts'
import { BoardDTOSchema } from '@dtos/BoardDTO.ts'
import { BoardEditDTOSchema } from '@dtos/BoardEditDTO.ts'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.ts'
import { BoardMoveDTOSchema } from '@/application/dtos/BoardMoveDTO.ts'

interface IBoardRawController extends BoardController {}

export default (controller: IBoardRawController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/count', controller.getCount)
  router.get('/:id', controller.getById)

  router.post('/', postEntitiesLimiter, validationMiddleware(BoardDTOSchema), controller.create)
  router.patch(
    '/move',
    patchEntitiesLimiter,
    validationMiddleware(BoardMoveDTOSchema),
    controller.move,
  )
  router.patch(
    '/:id',
    patchEntitiesLimiter,
    validationMiddleware(BoardEditDTOSchema),
    controller.update,
  )
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', patchEntitiesLimiter, controller.archive)
  router.patch('/:id/recover', patchEntitiesLimiter, controller.recover)
  router.post('/:id/clone', postEntitiesLimiter, controller.clone)

  return router
}
