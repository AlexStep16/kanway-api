import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IChatCriteria extends IBaseCriteria {
  threadId?: string
  threadIds?: string[]

  chatId?: string
  chatIds?: string[]

  workspaceId?: string
  workspaceIds?: string[]
}
