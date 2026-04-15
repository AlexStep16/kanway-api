import OperationLogModel from '@models/OperationLogModel.js'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.js'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IOperationLogCriteria } from '@interfaces/criterias/IOperationLogCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { IOperationLog } from '@entities/IOperationLog.js'
import { IOperationLogCreatePayload } from '../interfaces/IOperationLogCreatePayload.js'

export default class OperationLogRepository extends BaseRepository<
  IOperationLogRaw,
  IOperationLog,
  IOperationLogCriteria,
  IOperationLogCreatePayload
> {
  constructor() {
    super(OperationLogModel)
  }

  public buildFilter(
    criteria: IOperationLogCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<IOperationLogRaw> {
    const filter: FilterQuery<IOperationLogRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    return filter
  }
}
