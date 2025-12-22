import OperationLogModel from '@models/OperationLogModel.ts'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { OperationLogCriteria } from '@interfaces/criterias/OperationLogCriteria.ts'
import { FilterQuery, Types } from 'mongoose'

export default class OperationLogRepository extends BaseRepository<
  IOperationLogRaw,
  typeof OperationLogModel
> {
  constructor() {
    super(OperationLogModel)
  }

  public buildFilter(
    criteria: OperationLogCriteria,
    userId: Types.ObjectId
  ): FilterQuery<IOperationLogRaw> {
    const filter: FilterQuery<IOperationLogRaw> = { user_id: userId }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    return filter
  }
}
