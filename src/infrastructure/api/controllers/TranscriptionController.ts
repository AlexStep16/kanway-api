import SuccessResponse from '@/application/services/SuccessResponse.js'
import { NextFunction, Request, Response } from 'express'
import { TranscriptionService } from '@/infrastructure/services/TranscriptionService.js'
import { UserService } from '@/application/services/UserService.js'
import { calculateAudioCredits } from '@/application/ai/helpers/calculateAudioCredits.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { AppError } from '@errors/AppError.js'

export class TranscriptionController {
  protected service: TranscriptionService
  protected userService: UserService

  constructor(serviceInstance: TranscriptionService, userServiceInstance: UserService) {
    this.service = serviceInstance
    this.userService = userServiceInstance
  }

  public transcribe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('Аудиофайл не найден', 400)
      }

      const { text, usage } = await this.service.transcribe(req.file)

      if (usage) {
        const creditsSpent = calculateAudioCredits(usage, ModelsEnum.GPT_TRANSCRIBE)
        const userAudioCredits = req.user?.audioCreditsSpent || 0

        await this.userService.edit(
          {
            audioCreditsSpent: userAudioCredits + creditsSpent,
          },
          {
            id: req.user!.id.toString(),
          },
        )
      }

      res.status(200).json(new SuccessResponse({ transcript: text }))
    } catch (error) {
      next(error)
    }
  }
}
