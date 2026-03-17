import { IChatMessageRoles } from '../IChatMessageRoles.ts'
import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IChatMessageCriteria extends IBaseCriteria {
  chatId?: string
  chatIds?: string[]

  threadId?: string
  threadIds?: string[]

  role?: IChatMessageRoles
  roles?: IChatMessageRoles[]

  pendingToolCallId?: string
  pendingToolCallIds?: string[]
}
