import express, { Router } from 'express'
import SupportController from '@controllers/SupportController.ts'
import { supportLimiter } from '@/limiters.ts'
import { validationMiddleware } from '../middlewares/validations/validationMiddleware.ts'
import { SupportSchemaDTO } from '@/application/dtos/SupportDTO.ts'

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
