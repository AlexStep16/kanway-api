import express, { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import ChatController from '@controllers/ChatController.ts'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.ts'
import { ChatSendDTOSchema } from '@dtos/ChatSendDTO.ts'
import { aiLimiter, patchEntitiesLimiter } from '@/limiters.ts'
import { ChatEditDTOSchema } from '@/application/dtos/ChatEditDTO.ts'

export default (controller: ChatController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)

  router.get('/', controller.getAll)
  router.get('/:id', controller.getById)
  router.delete('/:id', controller.delete.bind(controller))
  router.post(
    '/send',
    aiLimiter,
    validationMiddleware(ChatSendDTOSchema),
    controller.send.bind(controller),
  )
  router.post('/retry', aiLimiter, controller.retry.bind(controller))
  router.patch(
    '/:id',
    patchEntitiesLimiter,
    validationMiddleware(ChatEditDTOSchema),
    controller.update,
  )
  router.get('/stream/:jobId/status', controller.streamStatus.bind(controller))
  router.post('/log/approve', aiLimiter, controller.approveLog.bind(controller))
  router.post('/tools/resolve-ambiguous', aiLimiter, controller.resolveAmbiguous.bind(controller))
  router.post('/:jobId/stop', controller.stopAgent.bind(controller))

  return router
}
