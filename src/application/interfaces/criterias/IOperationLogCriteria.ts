import { IBaseCriteria } from '../IBaseCriteria.ts'

export interface IOperationLogCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]
}
