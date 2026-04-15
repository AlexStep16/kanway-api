import { Types } from 'mongoose'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { OperationLogStatusesEnum } from '../enums/OperationLogStatusesEnum.js'

export interface IOperationLog {
  id: Types.ObjectId
  operationType: OperationTypesEnum
  collectionName: string
  entitiesBefore?: any[]
  entitiesAfter?: any[]
  status: OperationLogStatusesEnum
  selectedIds: string[]
  isUndone: boolean
  userId: Types.ObjectId
  dependencies: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}
