import { IBaseCriteria } from './IBaseCriteria.ts'

export interface ISubscriptionCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]
}
