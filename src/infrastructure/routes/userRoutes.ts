import { Router } from 'express'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.ts'
import { validationMiddleware } from '@middlewares/validationMiddleware.ts'
import { UserController } from '@controllers/UserController.ts'
import { UserEditSchemaDTO } from '@dtos/UserEditDTO.ts'
import multer from 'multer'

const upload = multer({ dest: 'uploads/' })

export default (controller: UserController): Router => {
  const router = Router({ mergeParams: true })

  router.use(jwtAuthMiddleware)

  router.get('/', controller.me)
  router.patch('/avatar', upload.single('avatar'), controller.updateAvatar)
  router.delete('/avatar', upload.single('avatar'), controller.resetAvatar)
  router.patch('/', validationMiddleware(UserEditSchemaDTO), controller.update)
  router.delete('/', controller.delete)

  return router
}
