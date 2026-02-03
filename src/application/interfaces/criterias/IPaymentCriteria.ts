import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IPaymentCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]
}
