import express from 'express'
import AuthController from '@controllers/AuthController.ts'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '../middlewares/validationMiddleware.ts'
import { RegisterCredentialsSchema } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { LoginCredentialsSchema } from '@/application/dtos/LoginCredentialsDTO.ts'

export default (controller: AuthController) => {
  const router = express.Router()

  router.post(
    '/register',
    validationMiddleware(RegisterCredentialsSchema),
    controller.register.bind(controller)
  )
  router.post(
    '/login',
    validationMiddleware(LoginCredentialsSchema),
    controller.login.bind(controller)
  )
  router.get('/me', jwtAuthMiddleware, controller.me.bind(controller))

  return router
}
