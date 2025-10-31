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
    const filter: FilterQuery<ICategoryRaw> = { user_id: userId, is_deleted: false }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.isDeleted !== undefined) {
      filter.is_deleted = criteria.isDeleted
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

    return filter
  }

  public async getAllToOrder(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ICategoryRaw[]> {
    return await this.model
      .find({ workspace_id: workspaceId, user_id: userId, is_deleted: false })
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
      .find({ _id: { $in: ids }, user_id: userId, is_deleted: false })
      .session(session || null)
      .lean()
  }

  public async getCountGrouppedByWorkspaces(
    workspaceIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ workspace_id: Types.ObjectId; count: number }[]> {
    const result = await this.model.aggregate(
      [
        { $match: { is_deleted: false, workspace_id: { $in: workspaceIds }, user_id: userId } },
        { $group: { _id: '$workspace_id', count: { $sum: 1 } } },
      ],
      { session }
    )

    return result
  }
}
