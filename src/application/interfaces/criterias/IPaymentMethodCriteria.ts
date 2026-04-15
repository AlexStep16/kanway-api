import { IBaseCriteria } from './IBaseCriteria.js'

export interface IPaymentMethodCriteria extends IBaseCriteria {
  serviceId?: string
}
