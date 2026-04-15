import CheckpointWrite from '@models/CheckpointWrite.js'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { ICheckpointWriteCriteria } from '../interfaces/criterias/ICheckpointWriteCriteria.js'
import { FilterQuery } from 'mongoose'
import { ICheckpointWriteRaw } from '@/domain/entities/ICheckpointWriteRaw.js'
import { ICheckpointWrite } from '@/domain/entities/ICheckpointWrite.js'

export default class CheckpointWriteRepository extends BaseRepository<
  ICheckpointWriteRaw,
  ICheckpointWrite,
  ICheckpointWriteCriteria
> {
  constructor() {
    super(CheckpointWrite)
  }

  public buildFilter(criteria: ICheckpointWriteCriteria): FilterQuery<ICheckpointWriteRaw> {
    const filter: FilterQuery<ICheckpointWriteRaw> = {}

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.threadId) {
      filter.thread_id = criteria.threadId
    } else if (criteria.threadIds) {
      filter.thread_id = { $in: criteria.threadIds }
    }

    return filter
  }
}
