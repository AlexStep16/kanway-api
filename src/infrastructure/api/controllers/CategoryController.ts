import { CategoryService } from '@application/services/CategoryService.ts'
import { ICategory } from '@entities/ICategory.ts'
import { CategoryDTO } from '@application/dtos/CategoryDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { ICategoryCriteria } from '@interfaces/criterias/ICategoryCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'

export default class CategoryController extends BaseController<
  ICategory,
  CategoryService,
  ICategoryCriteria,
  CategoryDTO,
  CategoryEditDTO,
  ICategoryPopulated
> {
  constructor(serviceInstance: CategoryService) {
    super(serviceInstance)
  }

  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: ICategoryCriteria = {
        boardId: req.params.boardId,
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
