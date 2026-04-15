import { Types } from 'mongoose'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { OperationLogStatusesEnum } from '../enums/OperationLogStatusesEnum.js'

export interface IOperationLogRaw {
  _id: Types.ObjectId
  operation_type: OperationTypesEnum
  collection_name: string
  entities_before?: any[]
  entities_after?: any[]
  status: OperationLogStatusesEnum
  selected_ids: string[]
  is_undone: boolean
  user_id: Types.ObjectId
  dependencies: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}
