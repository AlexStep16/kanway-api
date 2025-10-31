import OperationLogModel from '@models/OperationLogModel.ts'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'

export default class OperationLogRepository extends BaseRepository<
  IOperationLogRaw,
  typeof OperationLogModel
> {
  constructor() {
    super(OperationLogModel)
  }
}
