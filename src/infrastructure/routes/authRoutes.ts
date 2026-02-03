import express, { Router } from 'express'
import AuthController from '@controllers/AuthController.ts'
import { validationMiddleware } from '../middlewares/validationMiddleware.ts'
import { RegisterCredentialsSchema } from '@/application/dtos/RegisterCredentialsDTO.ts'
import { LoginCredentialsSchema } from '@/application/dtos/LoginCredentialsDTO.ts'
import { PasswordRecoveryLinkSchema } from '@/application/dtos/PasswordRecoveryLinkDTO.ts'
import { TokenWithTypePayloadSchemaDTO } from '@/application/dtos/TokenWithTypePayloadDTO.ts'

export default (controller: AuthController): Router => {
  const router = express.Router()

  router.post(
    '/register',
    validationMiddleware(RegisterCredentialsSchema),
    controller.register.bind(controller),
  )
  router.post(
    '/login',
    validationMiddleware(LoginCredentialsSchema),
    controller.login.bind(controller),
  )
  router.post(
    '/send/password/recovery',
    validationMiddleware(PasswordRecoveryLinkSchema),
    controller.sendResetPasswordEmail.bind(controller),
  )
  router.post(
    '/send/password/recovery/:token',
    controller.sendResetPasswordEmailByToken.bind(controller),
  )
  router.post('/send/verify/:token', controller.sendVerificationEmailByToken.bind(controller))
  router.post(
    '/verify/token',
    validationMiddleware(TokenWithTypePayloadSchemaDTO),
    controller.validateToken.bind(controller),
  )
  router.post('/verify', controller.confirmEmail.bind(controller))
  router.post('/password/recovery', controller.changeUserPassword.bind(controller))

  return router
}
