import { Types } from 'mongoose'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'

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
