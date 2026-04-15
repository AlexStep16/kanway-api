import { IBaseCriteria } from './IBaseCriteria.js'

export interface IPaymentCriteria extends IBaseCriteria {
  serviceId?: string
}
