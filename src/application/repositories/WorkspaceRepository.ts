import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
import WorkspaceModel from '@models/WorkspaceModel.ts'
import { IWorkspaceCriteria } from '@criterias/IWorkspaceCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IWorkspace } from '@entities/IWorkspace.ts'

export default class WorkspaceRepository extends BaseRepository<
  IWorkspaceRaw,
  IWorkspace,
  IWorkspaceCriteria
> {
  constructor() {
    super(WorkspaceModel)
  }

  public buildFilter(
    criteria: IWorkspaceCriteria,
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
}
