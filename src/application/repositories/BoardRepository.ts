import { IBoardRaw } from '@entities/IBoardRaw.js'
import BoardModel from '@models/BoardModel.js'
import { IBoardCriteria } from '@criterias/IBoardCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IBoard } from '@entities/IBoard.js'
import { IBoardCreatePayload } from '@interfaces/IBoardCreatePayload.js'

export default class BoardRepository extends BaseRepository<
  IBoardRaw,
  IBoard,
  IBoardCriteria,
  IBoardCreatePayload
> {
  constructor() {
    super(BoardModel)
  }

  public buildFilter(criteria: IBoardCriteria, userId?: Types.ObjectId): FilterQuery<IBoardRaw> {
    const filter: FilterQuery<IBoardRaw> = {}

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

    if (criteria.workspaceId) {
      filter.workspace = criteria.workspaceId
    }

    if (criteria.workspaceIds) {
      filter.workspace = { $in: criteria.workspaceIds }
    }

    return filter
  }
}
