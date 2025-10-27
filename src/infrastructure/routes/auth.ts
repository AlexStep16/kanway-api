import express from 'express'
import AuthController from '@controllers/AuthController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'

export default (controller: AuthController) => {
  const router = express.Router()

  router.post('/register', controller.register.bind(controller))
  router.post('/login', controller.login.bind(controller))
  router.get('/me', jwtAuthMiddleware, controller.me.bind(controller))

  return router
}
