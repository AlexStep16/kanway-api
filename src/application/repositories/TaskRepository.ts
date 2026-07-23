import { ITaskRaw } from '@entities/ITaskRaw.js'
import TaskModel from '@models/TaskModel.js'
import { ITaskCriteria } from '@criterias/ITaskCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { ITask } from '@entities/ITask.js'
import { ITaskCreatePayload } from '@interfaces/ITaskCreatePayload.js'

export default class TaskRepository extends BaseRepository<
  ITaskRaw,
  ITask,
  ITaskCriteria,
  ITaskCreatePayload
> {
  constructor() {
    super(TaskModel)
  }

  public buildFilter(criteria: ITaskCriteria, userId?: Types.ObjectId): FilterQuery<ITaskRaw> {
    const filter: FilterQuery<ITaskRaw> = {}

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

    if (criteria.isDeletedExternal !== undefined) {
      filter.is_deleted_external = criteria.isDeletedExternal
    }

    if (criteria.name) {
      filter.name = { $regex: criteria.name, $options: 'i' }
    }

    if (criteria.columnId) {
      filter.column = criteria.columnId
    }

    if (criteria.columnIds) {
      filter.column = { $in: criteria.columnIds }
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

  public async updateEmbeddings(
    tasks: Array<{ id: Types.ObjectId; name: string; embeddings: number[] }>,
    userId: Types.ObjectId,
  ) {
    if (tasks.length === 0) return

    await this.model.bulkWrite(
      tasks.map((task) => ({
        updateOne: {
          filter: { _id: task.id, user_id: userId, name: task.name },
          update: { $set: { embeddings: task.embeddings } },
        },
      })),
    )
  }
}
