import { ICategoryRaw } from '@entities/ICategoryRaw.ts'
import CategoryModel from '@models/CategoryModel.ts'
import { CategoryCriteria } from '@criterias/CategoryCriteria.ts'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'

export default class CategoryRepository
  extends BaseRepository<ICategoryRaw, typeof CategoryModel>
  implements IReorderRepository<ICategoryRaw>
{
  constructor() {
    super(CategoryModel)
  }

  public buildFilter(
    criteria: CategoryCriteria,
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
      filter.board_id = criteria.boardId
    }

    if (criteria.boardIds) {
      filter.board_id = { $in: criteria.boardIds }
    }

    if (criteria.workspaceId) {
      filter.workspace_id = criteria.workspaceId
    }

    if (criteria.workspaceIds) {
      filter.workspace_id = { $in: criteria.workspaceIds }
    }

    return filter
  }

  public async getAllToOrder(
    boardId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryRaw[]> {
    return await this.model
      .find({ board_id: boardId, user_id: userId, is_deleted: false })
      .session(session || null)
      .select('_id order')
      .sort({ order: 1 })
      .lean()
  }

  public async findByIds(
    ids: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryRaw[]> {
    return await this.model
      .find({ _id: { $in: ids }, user_id: userId })
      .session(session || null)
      .lean()
  }

  public async getCountGrouppedByBoards(
    boardIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ board_id: Types.ObjectId; count: number }[]> {
    const result = await this.model.aggregate(
      [
        { $match: { is_deleted: false, board_id: { $in: boardIds }, user_id: userId } },
        { $group: { _id: '$board_id', count: { $sum: 1 } } },
      ],
      { session }
    )

    return result
  }
}
