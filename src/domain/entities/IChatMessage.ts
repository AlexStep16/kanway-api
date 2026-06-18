import { IChatMessageRoles } from '@/application/interfaces/IChatMessageRoles.js'
import { Types } from 'mongoose'

export interface IChatMessage {
  id: Types.ObjectId
  role: IChatMessageRoles
  content: any
  iterationId: string
  listType?: string
  pendingToolCallId?: string
  creditsUsed?: number
  audioCreditsUsed?: number
  rating?: boolean
  userId: Types.ObjectId
  chatId: Types.ObjectId
  threadId: string
  createdAt: Date
  updatedAt: Date
}
