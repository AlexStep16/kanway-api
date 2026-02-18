import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IChatMessageCriteria extends IBaseCriteria {
  chatId?: string
  chatIds?: string[]

  threadId?: string
  threadIds?: string[]
}
