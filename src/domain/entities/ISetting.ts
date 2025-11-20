import { Types } from 'mongoose'
import { AiConfirmationTypeEnum } from '@domain/enums/AiConfirmationTypeEnum.ts'

export interface ISetting {
  id: Types.ObjectId
  aiName: string
  aiConfirmationType: AiConfirmationTypeEnum
  aiDefaultCategory: string
  aiDefaultBoard: string
  userId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
