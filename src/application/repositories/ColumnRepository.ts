import { IColumnRaw } from '@entities/IColumnRaw.js'
import ColumnModel from '@models/ColumnModel.js'
import { IColumnCriteria } from '@criterias/IColumnCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IColumn } from '@entities/IColumn.js'
import { IColumnCreatePayload } from '@interfaces/IColumnCreatePayload.js'

export default class ColumnRepository extends BaseRepository<
  IColumnRaw,
  IColumn,
  IColumnCriteria,
  IColumnCreatePayload
> {
  constructor() {
    super(ColumnModel)
  }

  public buildFilter(criteria: IColumnCriteria, userId?: Types.ObjectId): FilterQuery<IColumnRaw> {
    const filter: FilterQuery<IColumnRaw> = {}

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
      filter.name = { $regex: new RegExp(criteria.name, 'i') }
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
    columns: Array<{ id: Types.ObjectId; name: string; embeddings: number[] }>,
    userId: Types.ObjectId,
  ) {
    if (columns.length === 0) return

    await this.model.bulkWrite(
      columns.map((column) => ({
        updateOne: {
          filter: {
            _id: column.id,
            user_id: userId,
            name: column.name,
          },
          update: { $set: { embeddings: column.embeddings } },
        },
      })),
    )
  }
}
