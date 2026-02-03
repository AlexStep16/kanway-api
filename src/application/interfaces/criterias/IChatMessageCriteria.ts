import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IChatMessageCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]

  chatId?: string
  chatIds?: string[]

  threadId?: string
  threadIds?: string[]
}
