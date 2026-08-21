import { Types } from 'mongoose'
import { OutboxEventTypeEnum } from '../enums/OutboxEventTypeEnum.js'
import { OutboxEventStatusEnum } from '../enums/OutboxEventStatusEnum.js'

export interface IOutboxEventRaw {
  _id: Types.ObjectId
  type: OutboxEventTypeEnum
  payload: Record<string, any>
  status: OutboxEventStatusEnum
  processed_at?: Date
  createdAt: Date
  updatedAt: Date
}
