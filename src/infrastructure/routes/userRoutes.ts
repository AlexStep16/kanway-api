import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { validationMiddleware } from '@/infrastructure/middlewares/validations/validationMiddleware.js'
import { UserController } from '@controllers/UserController.js'
import { UserEditSchemaDTO } from '@dtos/UserEditDTO.js'
import multer from 'multer'
import { emailSendLimiter, patchUserLimiter } from '@/limiters.js'

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 МБ в байтах
  },
})

export default (controller: UserController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.me)
  router.post('/accounts/yandex', patchUserLimiter, controller.linkYandexAccount)
  router.post('/accounts/vk', patchUserLimiter, controller.linkVkAccount)
  router.delete('/accounts/:provider', patchUserLimiter, controller.unlinkAccount)
  router.patch('/avatar', patchUserLimiter, upload.single('avatar'), controller.updateAvatar)
  router.delete('/avatar', patchUserLimiter, upload.single('avatar'), controller.resetAvatar)
  router.patch('/', patchUserLimiter, validationMiddleware(UserEditSchemaDTO), controller.update)
  router.delete('/', controller.deleteSoft)
  router.post('/send/verify', emailSendLimiter, controller.sendVerificationEmail.bind(controller))
  router.post('/logout', controller.logout.bind(controller))

  return router
}
