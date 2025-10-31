import { BoardService } from '@application/services/BoardService.ts'
import { IBoard } from '@entities/IBoard.ts'
import { BoardDTO } from '@application/dtos/BoardDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { BoardCriteria } from '@interfaces/criterias/BoardCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'

export default class BoardController extends BaseController<
  IBoard,
  BoardDTO,
  BoardCriteria,
  BoardService
> {
  constructor(serviceInstance: BoardService) {
    super(serviceInstance)
  }

  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: BoardCriteria = { workspaceId: req.params.workspaceId }
      const entities = await this.service.getAll(criteria, req.user.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
