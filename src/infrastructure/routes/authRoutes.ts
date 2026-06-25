import express, { Router } from 'express'
import AuthController from '@controllers/AuthController.js'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.js'
import { PasswordRecoveryLinkSchema } from '@/application/dtos/PasswordRecoveryLinkDTO.js'
import {
  emailCheckLimiter,
  emailSendLimiter,
  otpVerifyLimiter,
  signinLimiter,
  signupLimiter,
  socialAuthLimiter,
  tokenVerifyLimiter,
} from '@/limiters.js'
import { CheckEmailExistsSchemaDTO } from '@/application/dtos/CheckEmailExistsDTO.js'
import { TokenSchemaDTO } from '@/application/dtos/TokenDTO.js'
import { validateResetToken } from '../middlewares/validations/validateResetToken.js'
import { PasswordRecoverySchema } from '@/application/dtos/PasswordRecoveryDTO.js'
import { SigninCredentialsSchema } from '@/application/dtos/SigninCredentialsDTO.js'
import { FinishSignupCredentialsSchema } from '@/application/dtos/FinishSignupCredentialsDTO.js'
import { SignupCredentialsSchema } from '@/application/dtos/SignupCredentialsDTO.js'
import { validateFinishSignupToken } from '../middlewares/validations/validateFinishSignupToken.js'

export default (controller: AuthController): Router => {
  const router = express.Router()

  router.post(
    '/sign-up',
    signupLimiter,
    validationMiddleware(SignupCredentialsSchema),
    controller.register.bind(controller),
  )
  router.get(
    '/sign-up/finish/check',
    validateFinishSignupToken,
    controller.checkSignup.bind(controller),
  )
  router.post(
    '/sign-up/finish',
    validateFinishSignupToken,
    validationMiddleware(FinishSignupCredentialsSchema),
    controller.finishSignup.bind(controller),
  )
  router.post(
    '/sign-in',
    signinLimiter,
    validationMiddleware(SigninCredentialsSchema),
    controller.login.bind(controller),
  )
  router.post(
    '/send/password/recovery',
    validationMiddleware(PasswordRecoveryLinkSchema),
    emailSendLimiter,
    controller.sendResetPasswordEmail.bind(controller),
  )
  router.post('/yandex', socialAuthLimiter, controller.yandex.bind(controller))
  router.post('/vk', socialAuthLimiter, controller.vk.bind(controller))
  router.post('/send/magic-link', emailSendLimiter, controller.sendMagicLink.bind(controller))
  router.post(
    '/verify/token/email',
    tokenVerifyLimiter,
    validationMiddleware(TokenSchemaDTO),
    controller.verifyLinkEmail.bind(controller),
  )
  router.post(
    '/verify/token/login',
    tokenVerifyLimiter,
    validationMiddleware(TokenSchemaDTO),
    controller.verifyLinkLogin.bind(controller),
  )
  router.post(
    '/verify/token/password',
    tokenVerifyLimiter,
    validationMiddleware(TokenSchemaDTO),
    controller.verifyLinkPassword.bind(controller),
  )
  router.post('/verify/otp/login', otpVerifyLimiter, controller.verifyOTPLogin.bind(controller))
  router.post('/verify/otp/email', otpVerifyLimiter, controller.verifyOTPEmail.bind(controller))
  router.post(
    '/verify/otp/password',
    otpVerifyLimiter,
    controller.verifyOTPPassword.bind(controller),
  )

  router.post(
    '/check-email',
    emailCheckLimiter,
    validationMiddleware(CheckEmailExistsSchemaDTO),
    controller.checkEmailExists.bind(controller),
  )
  router.post(
    '/password/recovery',
    validateResetToken,
    validationMiddleware(PasswordRecoverySchema),
    controller.changeUserPassword.bind(controller),
  )

  return router
}
