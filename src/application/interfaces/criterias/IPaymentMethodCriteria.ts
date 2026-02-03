import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IPaymentMethodCriteria extends IBaseCriteria {
  id?: string
  ids?: string[]
}
