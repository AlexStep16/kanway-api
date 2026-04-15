import express, { Router } from 'express'
import SupportController from '@controllers/SupportController.js'
import { supportLimiter } from '@/limiters.js'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.js'
import { SupportSchemaDTO } from '@/application/dtos/SupportDTO.js'

export default (controller: SupportController): Router => {
  const router = express.Router()

  router.post(
    '/',
    validationMiddleware(SupportSchemaDTO),
    supportLimiter,
    controller.createSupportTicket.bind(controller),
  )

  return router
}
