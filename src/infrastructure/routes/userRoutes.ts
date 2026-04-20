import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { UserController } from '@controllers/UserController.js'
import { UserEditSchemaDTO } from '@dtos/UserEditDTO.js'
import multer from 'multer'
import { emailLimiter, patchUserLimiter } from '@/limiters.js'

const upload = multer({ dest: 'uploads/' })

export default (controller: UserController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.me)
  router.patch('/avatar', patchUserLimiter, upload.single('avatar'), controller.updateAvatar)
  router.delete('/avatar', patchUserLimiter, upload.single('avatar'), controller.resetAvatar)
  router.patch('/', patchUserLimiter, validationMiddleware(UserEditSchemaDTO), controller.update)
  router.delete('/', controller.delete)
  router.post('/send/verify', emailLimiter, controller.sendVerificationEmail.bind(controller))
  router.post('/verify/otp', controller.verifyOTP.bind(controller))
  router.post('/logout', controller.logout.bind(controller))

  return router
}
