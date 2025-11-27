import { CategoryService } from '@application/services/CategoryService.ts'
import { ICategory } from '@entities/ICategory.ts'
import { CategoryDTO } from '@application/dtos/CategoryDTO.ts'
import { BaseController } from '@controllers/BaseController.ts'
import { CategoryCriteria } from '@interfaces/criterias/CategoryCriteria.ts'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.ts'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.ts'
import { ClonedCategoriesResult } from '@dtos/ClonedCategoriesResult.ts'
import { ICategoriesWithChildrenResponse } from '@/application/interfaces/ICategoriesWithChildrenResponse.ts'
import { ICategoryWithTempClientId } from '@application/interfaces/ICategoryWithTempClientId.ts'

export default class CategoryController extends BaseController<
  ICategory,
  CategoryDTO,
  CategoryCriteria,
  CategoryService,
  CategoryEditDTO,
  ClonedCategoriesResult,
  ICategoriesWithChildrenResponse,
  ICategoryWithTempClientId
> {
  constructor(serviceInstance: CategoryService) {
    super(serviceInstance)
  }

  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: CategoryCriteria = {
        boardId: req.params.boardId,
        ...req.query,
        isDeleted: false,
      }
      const entities = await this.service.getAll(criteria, req.user!.id)

      res.status(200).json(new SuccessResponse(entities))
    } catch (error) {
      next(error)
    }
  }
}
