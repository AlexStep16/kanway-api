import { IChatMessageRoles } from '@/application/interfaces/IChatMessageRoles.ts'
import { Types } from 'mongoose'

export interface IChatMessageRaw {
  _id: Types.ObjectId
  role: IChatMessageRoles
  content: any
  list_type?: string
  chat_id: Types.ObjectId
  user_id: Types.ObjectId
  thread_id: string
  createdAt: Date
  updatedAt: Date
}
