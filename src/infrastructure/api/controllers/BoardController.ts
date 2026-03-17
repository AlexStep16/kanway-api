import { BoardService } from '@application/services/BoardService.ts'
import { IBoard } from '@entities/IBoard.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { IBoardCriteria } from '@interfaces/criterias/IBoardCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { BoardEditDTO } from '@dtos/BoardEditDTO.ts'
import { BoardDTO } from '@dtos/BoardDTO.ts'
import { IBoardPopulated } from '@interfaces/IBoardPopulated.ts'

export default class BoardController extends BaseController<
  IBoard,
  BoardService,
  IBoardCriteria,
  BoardDTO,
  BoardEditDTO,
  IBoardPopulated
> {
  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: IBoardCriteria = {
        ...req.query,
        isDeleted: false,
      }
      const entities = await this.service.getByCriteria(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
