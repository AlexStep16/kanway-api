import { Types } from 'mongoose'
import { OPERATION_TYPES } from '@constants/OPERATION_TYPES.ts'

export interface IOperationLog {
  id: Types.ObjectId
  operationType: (typeof OPERATION_TYPES)[number]
  collectionName: string
  entitiesBefore?: any[]
  entitiesAfter?: any[]
  undoStatus: boolean
  userId: Types.ObjectId
  dependencies: Types.ObjectId[]
  threadId?: string
  createdAt: Date
  updatedAt: Date
}
