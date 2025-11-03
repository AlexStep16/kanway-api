import { ITaskRaw } from '@entities/ITaskRaw.ts'
import TaskModel from '@models/TaskModel.ts'
import { TaskCriteria } from '@criterias/TaskCriteria.ts'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'

export default class TaskRepository
  extends BaseRepository<ITaskRaw, typeof TaskModel>
  implements IReorderRepository<ITaskRaw>
{
  constructor() {
    super(TaskModel)
  }

  public buildFilter(criteria: TaskCriteria, userId: Types.ObjectId): FilterQuery<ITaskRaw> {
    const filter: FilterQuery<ITaskRaw> = { user_id: userId, is_deleted: false }

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

    if (criteria.categoryId) {
      filter.category_id = criteria.categoryId
    }

    if (criteria.categoryIds) {
      filter.category_id = { $in: criteria.categoryIds }
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
    categoryId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITaskRaw[]> {
    return await this.model
      .find({ category_id: categoryId, user_id: userId, is_deleted: false })
      .session(session || null)
      .select('_id order')
      .sort({ order: 1 })
      .lean()
  }

  public async findByIds(
    ids: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<ITaskRaw[]> {
    return await this.model
      .find({ _id: { $in: ids }, user_id: userId, is_deleted: false })
      .session(session || null)
      .lean()
  }

  public async getCountGrouppedByCategories(
    categoryIds: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<{ category_id: Types.ObjectId; count: number }[]> {
    const result = await this.model.aggregate(
      [
        { $match: { is_deleted: false, category_id: { $in: categoryIds }, user_id: userId } },
        { $group: { _id: '$category_id', count: { $sum: 1 } } },
      ],
      { session }
    )

    return result
  }
}
