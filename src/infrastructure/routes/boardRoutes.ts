import { Router } from 'express'
import BoardController from '@controllers/BoardController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@middlewares/validationMiddleware.ts'
import { BoardDTOSchema } from '@dtos/BoardDTO.ts'
import { BoardEditDTOSchema } from '@dtos/BoardEditDTO.ts'

interface IBoardController extends BoardController {}

export default (controller: IBoardController) => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)
  router.post('/', validationMiddleware(BoardDTOSchema), controller.create)
  router.patch('/:id', validationMiddleware(BoardEditDTOSchema), controller.update)
  router.delete('/:id', controller.delete)

  router.patch('/:id/archive', controller.archive)
  router.patch('/:id/recover', controller.recover)

  return router
}
