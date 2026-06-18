import { IChatMessageRoles } from '@/application/interfaces/IChatMessageRoles.js'
import { Types } from 'mongoose'

export interface IChatMessageRaw {
  _id: Types.ObjectId
  role: IChatMessageRoles
  content: any
  iteration_id: string
  list_type?: string
  pending_tool_call_id?: string
  credits_used?: number
  audio_credits_used?: number
  rating?: boolean
  chat_id: Types.ObjectId
  user_id: Types.ObjectId
  thread_id: string
  createdAt: Date
  updatedAt: Date
}
