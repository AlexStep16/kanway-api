import { Types } from 'mongoose'
import { OutboxEventTypeEnum } from '../enums/OutboxEventTypeEnum.js'
import { OutboxEventStatusEnum } from '../enums/OutboxEventStatusEnum.js'

export interface IOutboxEvent {
  id: Types.ObjectId
  type: OutboxEventTypeEnum
  payload: Record<string, any>
  status: OutboxEventStatusEnum
  processedAt?: Date
  createdAt: Date
  updatedAt: Date
}
