import { Types } from 'mongoose'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.ts'

export interface IOperationLogRaw {
  _id: Types.ObjectId
  operation_type: OperationTypesEnum
  collection_name: string
  entities_before?: any[]
  entities_after?: any[]
  is_undone: boolean
  user_id: Types.ObjectId
  dependencies: Types.ObjectId[]
  thread_id?: string
  createdAt: Date
  updatedAt: Date
}
