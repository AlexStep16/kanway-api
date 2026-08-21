import { OutboxEventStatusEnum } from '@/domain/enums/OutboxEventStatusEnum.js'
import { IBaseCriteria } from './IBaseCriteria.js'

export interface IOutboxEventCriteria extends IBaseCriteria {
  status?: OutboxEventStatusEnum
  statuses?: OutboxEventStatusEnum[]
}
