import { IBaseCriteria } from './IBaseCriteria.js'

export interface ICheckpointWriteCriteria extends IBaseCriteria {
  threadId?: string
  threadIds?: string[]
}
