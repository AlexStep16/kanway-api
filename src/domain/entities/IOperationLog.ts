import { Types } from 'mongoose'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'

export interface IOperationLog {
  id: Types.ObjectId
  operationType: OperationTypesEnum
  collectionName: string
  entitiesBefore?: any[]
  entitiesAfter?: any[]
  isUndone: boolean
  userId: Types.ObjectId
  dependencies: Types.ObjectId[]
  threadId?: string
  createdAt: Date
  updatedAt: Date
}
