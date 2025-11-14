import { IBoardRaw } from '@entities/IBoardRaw.ts'
import BoardModel from '@models/BoardModel.ts'
import { BoardCriteria } from '@criterias/BoardCriteria.ts'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'

export default class BoardRepository
  extends BaseRepository<IBoardRaw, typeof BoardModel>
  implements IReorderRepository<IBoardRaw>
{
  constructor() {
    super(BoardModel)
  }

  public buildFilter(criteria: BoardCriteria, userId: Types.ObjectId): FilterQuery<IBoardRaw> {
    const filter: FilterQuery<IBoardRaw> = { user_id: userId }

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

    if (criteria.workspaceId) {
      filter.workspace_id = criteria.workspaceId
    }

    if (criteria.workspaceIds) {
      filter.workspace_id = { $in: criteria.workspaceIds }
    }

    return filter
  }

  public async getAllToOrder(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoardRaw[]> {
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
  ): Promise<IBoardRaw[]> {
    return await this.model
      .find({ _id: { $in: ids }, user_id: userId })
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
