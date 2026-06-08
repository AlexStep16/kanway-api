import { Types } from 'mongoose'
import { AiConfirmationTypeEnum } from '@domain/enums/AiConfirmationTypeEnum.js'

export interface ISettingRaw {
  _id: Types.ObjectId
  ai_name: string
  ai_confirmation_type: AiConfirmationTypeEnum
  ai_default_column: string
  ai_default_board: string
  user_id: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}
