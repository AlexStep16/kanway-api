import express, { Router } from 'express'
import AuthController from '@controllers/AuthController.js'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.js'
import { RegisterCredentialsSchema } from '@/application/dtos/RegisterCredentialsDTO.js'
import { LoginCredentialsSchema } from '@/application/dtos/LoginCredentialsDTO.js'
import { PasswordRecoveryLinkSchema } from '@/application/dtos/PasswordRecoveryLinkDTO.js'
import { TokenWithTypePayloadSchemaDTO } from '@/application/dtos/TokenWithTypePayloadDTO.js'
import { emailLimiter } from '@/limiters.js'

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
    emailLimiter,
    controller.sendResetPasswordEmail.bind(controller),
  )
  router.post(
    '/send/password/recovery/:token',
    emailLimiter,
    controller.sendResetPasswordEmailByToken.bind(controller),
  )
  router.post('/yandex', controller.yandex.bind(controller))
  router.post(
    '/send/verify/:token',
    emailLimiter,
    controller.sendVerificationEmailByToken.bind(controller),
  )
  router.post(
    '/verify/token',
    validationMiddleware(TokenWithTypePayloadSchemaDTO),
    controller.validateToken.bind(controller),
  )
  router.post('/verify/token', controller.verifyToken.bind(controller))
  router.post('/password/recovery', controller.changeUserPassword.bind(controller))

  return router
}
