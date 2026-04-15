import express, { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import ChatMessageController from '@controllers/ChatMessageController.js'

export default (controller: ChatMessageController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)

  router.get('/:chatId', controller.getAll)

  return router
}
