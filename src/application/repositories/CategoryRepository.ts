import { ICategoryRaw } from '@entities/ICategoryRaw.js'
import CategoryModel from '@models/CategoryModel.js'
import { ICategoryCriteria } from '@criterias/ICategoryCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { ICategory } from '@entities/ICategory.js'
import { ICategoryCreatePayload } from '@interfaces/ICategoryCreatePayload.js'

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
    userId?: Types.ObjectId,
  ): FilterQuery<ICategoryRaw> {
    const filter: FilterQuery<ICategoryRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

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
      filter.name = { $regex: new RegExp(criteria.name, 'i') }
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
