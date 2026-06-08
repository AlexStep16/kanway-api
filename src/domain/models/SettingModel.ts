import { model, Schema } from 'mongoose'
import { ISettingRaw } from '@entities/ISettingRaw.js'
import { AiConfirmationTypeEnum } from '@domain/enums/AiConfirmationTypeEnum.js'

export const SettingSchema = new Schema<ISettingRaw>(
  {
    ai_name: {
      type: String,
      required: true,
    },
    ai_confirmation_type: {
      type: Number,
      enum: AiConfirmationTypeEnum,
      required: true,
    },
    ai_default_column: {
      type: String,
      default: '',
    },
    ai_default_board: {
      type: String,
      default: '',
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

const Setting = model<ISettingRaw>('Setting', SettingSchema)

export default Setting
