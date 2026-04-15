import SuccessResponse from '@/application/services/SuccessResponse.js'
import { Request, Response } from 'express'
import { EmailService } from '@/infrastructure/services/EmailService.js'
import SupportRepository from '@/application/repositories/SupportRepository.js'

export default class SupportController {
  protected repository: SupportRepository
  protected emailService: EmailService

  constructor(repositoryInstance: SupportRepository, serviceInstance: EmailService) {
    this.repository = repositoryInstance
    this.emailService = serviceInstance
  }

  public async createSupportTicket(req: Request, res: Response) {
    const { theme, details, email, name } = req.body

    await this.repository.create({ theme, details, email, name })

    await this.emailService.sendSupportEmail(theme, details, email, name)

    return res.status(200).json(new SuccessResponse(null))
  }
}
