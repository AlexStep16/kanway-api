import { Types } from 'mongoose'
import { OPERATION_TYPES } from '@constants/OPERATION_TYPES.ts'

export interface IOperationLog {
  _id: Types.ObjectId
  operation_type: (typeof OPERATION_TYPES)[number]
  collection_name: string
  entities_before?: any[]
  entities_after?: any[]
  undo_status: boolean
  user_id: Types.ObjectId
  dependencies: Types.ObjectId[]
  thread_id?: string
}
