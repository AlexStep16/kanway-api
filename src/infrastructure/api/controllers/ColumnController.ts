import { ColumnService } from '@application/services/ColumnService.js'
import { IColumn } from '@entities/IColumn.js'
import { ColumnDTO } from '@application/dtos/ColumnDTO.js'
import { BaseController } from '@controllers/BaseController.js'
import { IColumnCriteria } from '@interfaces/criterias/IColumnCriteria.js'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.js'
import { ColumnEditDTO } from '@dtos/ColumnEditDTO.js'
import { IColumnPopulated } from '@/application/interfaces/IColumnPopulated.js'

export default class ColumnController extends BaseController<
  IColumn,
  ColumnService,
  IColumnCriteria,
  ColumnDTO,
  ColumnEditDTO,
  IColumnPopulated
> {
  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: IColumnCriteria = {
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
