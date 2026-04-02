import Checkpoint from '@models/Checkpoint.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { ICheckpointCriteria } from '../interfaces/criterias/ICheckpointCriteria.ts'
import { FilterQuery } from 'mongoose'
import { ICheckpointRaw } from '@/domain/entities/ICheckpointRaw.ts'
import { ICheckpoint } from '@/domain/entities/ICheckpoint.ts'

export default class CheckpointRepository extends BaseRepository<
  ICheckpointRaw,
  ICheckpoint,
  ICheckpointCriteria
> {
  constructor() {
    super(Checkpoint)
  }

  public buildFilter(criteria: ICheckpointCriteria): FilterQuery<ICheckpointRaw> {
    const filter: FilterQuery<ICheckpointRaw> = {}

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
