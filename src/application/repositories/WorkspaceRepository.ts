import { IWorkspace } from '@entities/IWorkspace.ts'
import WorkspaceModel from '@models/WorkspaceModel.ts'
import { WorkspaceCriteria } from '@criterias/WorkspaceCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IReorderRepository } from '@traits/IReorderRepository.ts'

export default class WorkspaceRepository
  extends BaseRepository<IWorkspace, typeof WorkspaceModel>
  implements IReorderRepository<IWorkspace>
{
  public buildFilter(criteria: WorkspaceCriteria, userId: Types.ObjectId): FilterQuery<IWorkspace> {
    const filter: FilterQuery<IWorkspace> = { user_id: userId, is_deleted: false }

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

  public async getAllToOrder(_: string, userId: Types.ObjectId): Promise<IWorkspace[]> {
    return await this.model
      .find({ user_id: userId, is_deleted: false })
      .select('_id order')
      .sort({ order: 1 })
      .lean()
  }
}
