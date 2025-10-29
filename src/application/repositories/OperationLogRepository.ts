import OperationLogModel from '@models/OperationLogModel.ts'
import { IOperationLog } from '@entities/IOperationLog.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class OperationLogRepository extends BaseRepository<
  IOperationLog,
  typeof OperationLogModel
> {
  constructor() {
    super(OperationLogModel)
  }
}
