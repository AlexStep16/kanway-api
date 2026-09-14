import SuccessResponse from '@application/services/SuccessResponse.js'
import { NextFunction, Request, Response } from 'express'
import { TrelloService } from '@infrastructure/services/TrelloService.js'
import { TrelloImportDTO } from '@dtos/TrelloImportDTO.js'
import { IUser } from '@entities/IUser.js'
import { AppError } from '@errors/AppError.js'

export class TrelloController {
  protected service: TrelloService

  constructor(serviceInstance: TrelloService) {
    this.service = serviceInstance
  }

  public getConfig = (_req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = this.service.getApiKey()

      if (!apiKey) {
        throw new AppError('Не настроен ключ Trello API', 500)
      }

      res.status(200).json(new SuccessResponse({ apiKey }))
    } catch (error) {
      next(error)
    }
  }

  public getBoards = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.query.token as string

      if (!token) {
        throw new AppError('Токен Trello обязателен', 400)
      }

      const boards = await this.service.getBoards(token)

      res.status(200).json(new SuccessResponse(boards))
    } catch (error) {
      next(error)
    }
  }

  public importBoard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { boardIds, token, workspaceId } = req.body as TrelloImportDTO

      const board = boardIds?.length
        ? await this.service.importBoards(boardIds, token, workspaceId, req.user as IUser)
        : await this.service.importAllBoards(token, workspaceId, req.user as IUser)

      res.status(201).json(new SuccessResponse(board))
    } catch (error) {
      next(error)
    }
  }
}
