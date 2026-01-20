import { ITaskRaw } from '@entities/ITaskRaw.ts'
import TaskModel from '@models/TaskModel.ts'
import { ITaskCriteria } from '@criterias/ITaskCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { ITask } from '@entities/ITask.ts'
import { ITaskCreatePayload } from '@interfaces/ITaskCreatePayload.ts'

export default class TaskRepository extends BaseRepository<
  ITaskRaw,
  ITask,
  ITaskCriteria,
  ITaskCreatePayload
> {
  constructor() {
    super(TaskModel)
  }

  public buildFilter(criteria: ITaskCriteria, userId: Types.ObjectId): FilterQuery<ITaskRaw> {
    const filter: FilterQuery<ITaskRaw> = { user_id: userId }

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

    if (criteria.categoryId) {
      filter.category = criteria.categoryId
    }

    if (criteria.categoryIds) {
      filter.category = { $in: criteria.categoryIds }
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
