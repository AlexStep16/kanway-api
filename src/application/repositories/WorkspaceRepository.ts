import { IWorkspaceRaw } from '@entities/IWorkspaceRaw.ts'
import WorkspaceModel from '@models/WorkspaceModel.ts'
import { IWorkspaceCriteria } from '@criterias/IWorkspaceCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IWorkspace } from '@entities/IWorkspace.ts'
import { IWorkspaceCreatePayload } from '@interfaces/IWorkspaceCreatePayload.ts'

export default class WorkspaceRepository extends BaseRepository<
  IWorkspaceRaw,
  IWorkspace,
  IWorkspaceCriteria,
  IWorkspaceCreatePayload
> {
  constructor() {
    super(WorkspaceModel)
  }

  public buildFilter(
    criteria: IWorkspaceCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<IWorkspaceRaw> {
    const filter: FilterQuery<IWorkspaceRaw> = {}

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

    if (criteria.name) {
      filter.name = { $regex: criteria.name, $options: 'i' }
    }

    return filter
  }
}
