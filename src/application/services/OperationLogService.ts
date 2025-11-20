import OperationLogRepository from '@repositories/OperationLogRepository.ts'
import { ICreateOperationLogService } from '@traits/ICreateOperationLogService.ts'
import { IOperationLog } from '@entities/IOperationLog.ts'
import { OperationLogCreationDTO } from '@dtos/OperationLogCreationDTO.ts'
import { ClientSession, Types } from 'mongoose'
import { toMongoCaseKeys, toServerCaseKeys } from '@utils/objectTransformers.ts'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.ts'
import { SystemFields } from '@/infrastructure/types/SystemFields.ts'

export class OperationLogService
  implements ICreateOperationLogService<IOperationLog, OperationLogCreationDTO>
{
  protected repository: OperationLogRepository

  constructor(operationLogRepository: OperationLogRepository) {
    this.repository = operationLogRepository
  }

  public async create(
    data: OperationLogCreationDTO,
    userId: Types.ObjectId,
    session: ClientSession | null = null
  ): Promise<IOperationLog[]> {
    const operationLogPayload: Omit<IOperationLogRaw, SystemFields> = {
      ...toMongoCaseKeys(data),
      undo_status: false,
      user_id: userId,
    }

    const newOperationLog = await this.repository.create(operationLogPayload, session)

    return [toServerCaseKeys(newOperationLog)]
  }
}
