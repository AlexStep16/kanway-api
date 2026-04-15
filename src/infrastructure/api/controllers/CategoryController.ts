import { CategoryService } from '@application/services/CategoryService.js'
import { ICategory } from '@entities/ICategory.js'
import { CategoryDTO } from '@application/dtos/CategoryDTO.js'
import { BaseController } from '@controllers/BaseController.js'
import { ICategoryCriteria } from '@interfaces/criterias/ICategoryCriteria.js'
import { Request, Response, NextFunction } from 'express'
import SuccessResponse from '@application/services/SuccessResponse.js'
import { CategoryEditDTO } from '@dtos/CategoryEditDTO.js'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.js'

export default class CategoryController extends BaseController<
  ICategory,
  CategoryService,
  ICategoryCriteria,
  CategoryDTO,
  CategoryEditDTO,
  ICategoryPopulated
> {
  public override getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const criteria: ICategoryCriteria = {
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
