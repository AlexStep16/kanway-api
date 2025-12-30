import { IChatMessageRoles } from '@/application/interfaces/IChatMessageRoles.ts'
import { Types } from 'mongoose'

export interface IChatMessage {
  id: Types.ObjectId
  role: IChatMessageRoles
  content: any
  listType?: string
  userId: Types.ObjectId
  chatId: Types.ObjectId
  threadId: string
  createdAt: Date
  updatedAt: Date
}
