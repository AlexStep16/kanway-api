import { IBaseCriteria } from './IBaseCriteria.ts'

export interface ICheckpointCriteria extends IBaseCriteria {
  threadId?: string
  threadIds?: string[]
}
