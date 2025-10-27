import { Types } from 'mongoose'

export interface IOperationLog {
  _id?: Types.ObjectId
  operation_type: 'UPDATE' | 'CREATE' | 'DELETE' | 'ARCHIVE'
  collection_name: string
  undo_data: Array<{
    document_id: Types.ObjectId
    previous_version: object | null
    actual_version: object | null
  }>
  undo_status: boolean
  dependencies?: Array<Types.ObjectId>
  thread_id?: Types.ObjectId
  user_id: Types.ObjectId
}
