import express, { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import ChatMessageController from '@controllers/ChatMessageController.ts'

export default (controller: ChatMessageController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)

  router.get('/:chatId', controller.getAll)

  return router
}
