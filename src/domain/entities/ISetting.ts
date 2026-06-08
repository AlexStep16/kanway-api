import { Types } from 'mongoose'
import { AiConfirmationTypeEnum } from '@domain/enums/AiConfirmationTypeEnum.js'

export interface ISetting {
  id: Types.ObjectId
  aiName: string
  aiConfirmationType: AiConfirmationTypeEnum
  aiDefaultColumn: string
  aiDefaultBoard: string
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
