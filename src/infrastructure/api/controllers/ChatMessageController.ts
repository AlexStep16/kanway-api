import SuccessResponse from '@/application/services/SuccessResponse.js'
import { NextFunction, Request, Response } from 'express'
import { IChatMessageCriteria } from '@/application/interfaces/criterias/IChatMessageCriteria.js'
import { ChatMessageService } from '@/application/services/ChatMessageService.js'

export default class ChatMessageController {
  protected service: ChatMessageService

  constructor(serviceInstance: ChatMessageService) {
    this.service = serviceInstance
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entities = await this.service.getByCriteria(
        { ...req.query, chatId: req.params.chatId } as IChatMessageCriteria,
        req.user!.id,
        undefined,
        undefined,
        {
          sort: { createdAt: 1 },
        },
      )

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
