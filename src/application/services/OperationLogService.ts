import OperationLogRepository from '@repositories/OperationLogRepository.ts'
import { ICreateService } from '@traits/ICreateService.ts'
import { IOperationLog } from '@entities/IOperationLog.ts'
import { OperationLogCreationDTO } from '@dtos/OperationLogCreationDTO.ts'
import { ClientSession, Types } from 'mongoose'
import { toMongoCaseKeys } from '@utils/objectTransformers.ts'

export class OperationLogService implements ICreateService<IOperationLog, OperationLogCreationDTO> {
  protected repository: OperationLogRepository

  constructor(operationLogRepository: OperationLogRepository) {
    this.repository = operationLogRepository
  }

  public async create(
    data: OperationLogCreationDTO,
    userId: Types.ObjectId,
    session: ClientSession | null = null
  ): Promise<IOperationLog[]> {
    const operationLogPayload: Partial<IOperationLog> = {
      ...toMongoCaseKeys(data),
      undo_status: false,
      user_id: userId,
    }

    const newOperationLog = await this.repository.create(operationLogPayload, session)

    return [newOperationLog]
  }
}
