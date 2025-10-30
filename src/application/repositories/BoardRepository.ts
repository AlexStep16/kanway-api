import { IBoard } from '@entities/IBoard.ts'
import BoardModel from '@models/BoardModel.ts'
import { BoardCriteria } from '@criterias/BoardCriteria.ts'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'

export default class BoardRepository
  extends BaseRepository<IBoard, typeof BoardModel>
  implements IReorderRepository<IBoard>
{
  constructor() {
    super(BoardModel)
  }

  public buildFilter(criteria: BoardCriteria, userId: Types.ObjectId): FilterQuery<IBoard> {
    const filter: FilterQuery<IBoard> = { user_id: userId, is_deleted: false }

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

    return filter
  }

  public async getAllToOrder(
    workspaceId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IBoard[]> {
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
  ): Promise<IBoard[]> {
    return await this.model
      .find({ _id: { $in: ids }, user_id: userId, is_deleted: false })
      .session(session || null)
      .lean()
  }
}
