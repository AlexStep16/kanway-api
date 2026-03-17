import { Types } from 'mongoose'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'

export interface IOperationLogCreatePayload {
  operationType: OperationTypesEnum
  collectionName: string
  entitiesBefore?: any[]
  entitiesAfter?: any[]
  status?: OperationLogStatusesEnum
  isUndone?: boolean
  userId: Types.ObjectId
  dependencies: Types.ObjectId[]
}
