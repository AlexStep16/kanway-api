import express, { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import ChatController from '@controllers/ChatController.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { ChatSendDTOSchema } from '@dtos/ChatSendDTO.js'
import { aiLimiter, patchEntitiesLimiter } from '@/limiters.js'
import { ChatEditDTOSchema } from '@/application/dtos/ChatEditDTO.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'
import { UpdateChatNameDTOSchema } from '@/application/dtos/UpdateChatNameDTO.js'

export default (controller: ChatController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

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
  router.patch(
    '/:id/update-name',
    aiLimiter,
    validationMiddleware(UpdateChatNameDTOSchema),
    controller.updateChatName.bind(controller),
  )
  router.get('/stream/:jobId/status', controller.streamStatus.bind(controller))
  router.post('/tool/approve', aiLimiter, controller.approveTool.bind(controller))
  router.post('/:jobId/stop', controller.stopAgent.bind(controller))

  return router
}
