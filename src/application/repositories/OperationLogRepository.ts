import OperationLogModel from '@models/OperationLogModel.ts'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IOperationLogCriteria } from '@interfaces/criterias/IOperationLogCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { IOperationLog } from '@entities/IOperationLog.ts'

export default class OperationLogRepository extends BaseRepository<
  IOperationLogRaw,
  IOperationLog,
  IOperationLogCriteria
> {
  constructor() {
    super(OperationLogModel)
  }

  public buildFilter(
    criteria: IOperationLogCriteria,
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
