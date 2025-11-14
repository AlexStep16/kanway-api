import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
import WorkspaceModel from '@models/WorkspaceModel.ts'
import { WorkspaceCriteria } from '@criterias/WorkspaceCriteria.ts'
import { ClientSession, FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'

export default class WorkspaceRepository
  extends BaseRepository<IWorkspaceRaw, typeof WorkspaceModel>
  implements IReorderRepository<IWorkspaceRaw>
{
  constructor() {
    super(WorkspaceModel)
  }

  public buildFilter(
    criteria: WorkspaceCriteria,
    userId: Types.ObjectId
  ): FilterQuery<IWorkspaceRaw> {
    const filter: FilterQuery<IWorkspaceRaw> = { user_id: userId }

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

    return filter
  }

  public async getAllToOrder(
    _: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IWorkspaceRaw[]> {
    return await this.model
      .find({ user_id: userId, is_deleted: false })
      .session(session || null)
      .select('_id order')
      .sort({ order: 1 })
      .lean()
  }

  public async findByIds(
    ids: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<IWorkspaceRaw[]> {
    return await this.model
      .find({ _id: { $in: ids }, user_id: userId })
      .session(session || null)
      .lean()
  }
}
