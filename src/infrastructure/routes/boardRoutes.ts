import { Router } from 'express'
import BoardController from '@controllers/BoardController.js'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { BoardDTOSchema } from '@dtos/BoardDTO.js'
import { BoardEditDTOSchema } from '@dtos/BoardEditDTO.js'
import { patchEntitiesLimiter, postEntitiesLimiter } from '@/limiters.js'
import { BoardMoveDTOSchema } from '@/application/dtos/BoardMoveDTO.js'

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
