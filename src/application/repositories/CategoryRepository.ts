import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import CategoryModel from '@models/CategoryModel.ts'
import { ICategoryCriteria } from '@criterias/ICategoryCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { ICategory } from '@entities/ICategory.ts'
import { ICategoryCreatePayload } from '@interfaces/ICategoryCreatePayload.ts'

export default class CategoryRepository extends BaseRepository<
  ICategoryRaw,
  ICategory,
  ICategoryCriteria,
  ICategoryCreatePayload
> {
  constructor() {
    super(CategoryModel)
  }

  public buildFilter(
    criteria: ICategoryCriteria,
    userId: Types.ObjectId
  ): FilterQuery<ICategoryRaw> {
    const filter: FilterQuery<ICategoryRaw> = { user_id: userId }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.isDeleted !== undefined) {
      filter.is_deleted = criteria.isDeleted
    }

    if (criteria.isDeletedExternal !== undefined) {
      filter.is_deleted_external = criteria.isDeletedExternal
    }

    if (criteria.name) {
      filter.name = { $regex: criteria.name, $options: 'i' }
    }

    if (criteria.boardId) {
      filter.board = criteria.boardId
    }

    if (criteria.boardIds) {
      filter.board = { $in: criteria.boardIds }
    }

    if (criteria.workspaceId) {
      filter.workspace = criteria.workspaceId
    }

    if (criteria.workspaceIds) {
      filter.workspace = { $in: criteria.workspaceIds }
    }

    return filter
  }
}
