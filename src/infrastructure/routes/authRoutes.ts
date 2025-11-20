import express, { Router } from 'express'
import AuthController from '@controllers/AuthController.ts'
import { validationMiddleware } from '../middlewares/validationMiddleware.ts'
import { RegisterCredentialsSchema } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { LoginCredentialsSchema } from '@/application/dtos/LoginCredentialsDTO.ts'

export default (controller: AuthController): Router => {
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

  return router
}
