import { IBaseCriteria } from './IBaseCriteria.ts'

export interface IPaymentCriteria extends IBaseCriteria {
  serviceId?: string
}
