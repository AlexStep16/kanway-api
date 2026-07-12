import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.js'
import { IBaseCriteria } from './IBaseCriteria.js'

export interface IPaymentCriteria extends IBaseCriteria {
  serviceId?: string
  status?: PaymentStatusesEnum
  statuses?: PaymentStatusesEnum[]
  statusesNot?: PaymentStatusesEnum[]
}
