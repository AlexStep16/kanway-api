import { IBaseCriteria } from './IBaseCriteria.ts'

export interface ICheckpointWriteCriteria extends IBaseCriteria {
  threadId?: string
  threadIds?: string[]
}
