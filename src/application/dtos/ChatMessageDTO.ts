import { Types } from 'mongoose'
import { IChatMessageRoles } from '@application/interfaces/IChatMessageRoles.ts'

export interface ChatMessageDTO {
  role: IChatMessageRoles
  content: any
  listType?: string
  pendingToolCallId?: string
  threadId: string
  chatId: Types.ObjectId
  isResolved?: boolean
}
