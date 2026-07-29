import express, { Router } from 'express'
import multer from 'multer'
import { jwtAuthMiddleware } from '@infrastructure/auth/passportJWTStrategy.js'
import { confirmationMiddleware } from '../auth/confirmationMiddleware.js'
import { TranscriptionController } from '@controllers/TranscriptionController.js'
import { aiLimiter } from '@/limiters.js'

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 МБ в байтах
  },
})

export default (controller: TranscriptionController): Router => {
  const router = express.Router()

  router.use(jwtAuthMiddleware)
  router.use(confirmationMiddleware)

  router.post('/transcribe', aiLimiter, upload.single('audio'), controller.transcribe)

  return router
}
