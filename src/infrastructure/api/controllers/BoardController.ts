import { BoardService } from '@application/services/BoardService.js'
import { IBoard } from '@entities/IBoard.js'
import { BaseController } from '@controllers/BaseController.js'
import { IBoardCriteria } from '@interfaces/criterias/IBoardCriteria.js'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.js'
import { BoardEditDTO } from '@dtos/BoardEditDTO.js'
import { BoardDTO } from '@dtos/BoardDTO.js'
import { IBoardPopulated } from '@interfaces/IBoardPopulated.js'

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
