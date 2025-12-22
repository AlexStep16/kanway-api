import SuccessResponse from '@/application/services/SuccessResponse.ts'
import { NextFunction, Request, Response } from 'express'
import { ChatMessageCriteria } from '@/application/interfaces/criterias/ChatMessageCriteria.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'

export default class ChatMessageController {
  protected service: ChatMessageService

  constructor(serviceInstance: ChatMessageService) {
    this.service = serviceInstance
  }

  public getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const entities = await this.service.getAll(
        { ...req.query, chatId: req.params.chatId } as ChatMessageCriteria,
        req.user!.id
      )

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
