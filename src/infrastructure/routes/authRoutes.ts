import express, { Router } from 'express'
import AuthController from '@controllers/AuthController.js'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.js'
import { RegisterCredentialsSchema } from '@/application/dtos/RegisterCredentialsDTO.js'
import { LoginCredentialsSchema } from '@/application/dtos/LoginCredentialsDTO.js'
import { PasswordRecoveryLinkSchema } from '@/application/dtos/PasswordRecoveryLinkDTO.js'
import { emailLimiter } from '@/limiters.js'
import { CheckEmailExistsSchemaDTO } from '@/application/dtos/CheckEmailExistsDTO.js'
import { TokenSchemaDTO } from '@/application/dtos/TokenDTO.js'

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
  router.post('/yandex', controller.yandex.bind(controller))
  router.post('/vk', controller.vk.bind(controller))
  router.post('/send/magic-link', emailLimiter, controller.sendMagicLink.bind(controller))
  router.post(
    '/verify/token/email',
    validationMiddleware(TokenSchemaDTO),
    controller.verifyLinkEmail.bind(controller),
  )
  router.post(
    '/verify/token/login',
    validationMiddleware(TokenSchemaDTO),
    controller.verifyLinkLogin.bind(controller),
  )
  router.post('/verify/otp/login', controller.verifyOTPLogin.bind(controller))
  router.post('/verify/otp/email', controller.verifyOTPEmail.bind(controller))
  router.post('/validate/token/recovery', controller.validateRecoveryToken.bind(controller))

  router.post(
    '/check-email',
    validationMiddleware(CheckEmailExistsSchemaDTO),
    controller.checkEmailExists.bind(controller),
  )
  router.post('/password/recovery', controller.changeUserPassword.bind(controller))

  return router
}
