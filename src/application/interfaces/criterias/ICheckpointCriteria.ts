import { IBaseCriteria } from './IBaseCriteria.js'

export interface ICheckpointCriteria extends IBaseCriteria {
  threadId?: string
  threadIds?: string[]
}
