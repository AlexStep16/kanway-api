import SuccessResponse from '@application/services/SuccessResponse.js'
import { NextFunction, Request, Response } from 'express'
import { YandexTrackerService } from '@infrastructure/services/YandexTrackerService.js'
import { YandexTrackerImportDTO } from '@dtos/YandexTrackerImportDTO.js'
import { YandexTrackerConnectDTO } from '@dtos/YandexTrackerConnectDTO.js'
import { IUser } from '@entities/IUser.js'
import { AppError } from '@errors/AppError.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export class YandexTrackerController {
  protected service: YandexTrackerService

  constructor(serviceInstance: YandexTrackerService) {
    this.service = serviceInstance
  }

  public connect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, codeVerifier } = req.body as YandexTrackerConnectDTO

      const token = await this.service.exchangeCode(code, codeVerifier)

      res.status(200).json(new SuccessResponse({ token }))
    } catch (error) {
      next(error)
    }
  }

  public getBoards = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.query.token as string
      const orgId = req.query.orgId as string

      if (!token) {
        throw new AppError(ErrorMessages.YANDEX_TRACKER_TOKEN_REQUIRED, 400)
      }

      if (!orgId) {
        throw new AppError(ErrorMessages.YANDEX_TRACKER_ORG_ID_REQUIRED, 400)
      }

      const boards = await this.service.getBoards({ token, orgId })

      res.status(200).json(new SuccessResponse(boards))
    } catch (error) {
      next(error)
    }
  }

  public importBoard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { boardIds, token, orgId, workspaceId } = req.body as YandexTrackerImportDTO
      const credentials = { token, orgId }

      const board = boardIds?.length
        ? await this.service.importBoards(boardIds, credentials, workspaceId, req.user as IUser)
        : await this.service.importAllBoards(credentials, workspaceId, req.user as IUser)

      res.status(201).json(new SuccessResponse(board))
    } catch (error) {
      next(error)
    }
  }
}
