import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IPaymentMethodCriteria extends IBaseCriteria {
  serviceId?: string
}
