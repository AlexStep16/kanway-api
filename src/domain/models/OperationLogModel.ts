import { Schema, model } from 'mongoose'
import { IOperationLogRaw } from '@entities/IOperationLogRaw.js'
import { OperationTypesEnum } from '@domain/enums/OperationTypesEnum.js'
import { OperationLogStatusesEnum } from '../enums/OperationLogStatusesEnum.js'

export const OperationLogSchema = new Schema<IOperationLogRaw>(
  {
    operation_type: {
      type: String,
      enum: OperationTypesEnum,
      required: true,
    },
    collection_name: {
      type: String,
      required: true,
    },
    entities_before: {
      type: [Schema.Types.Mixed],
    },
    entities_after: {
      type: [Schema.Types.Mixed],
    },
    status: {
      type: Number,
      enum: OperationLogStatusesEnum,
      default: OperationLogStatusesEnum.SUCCESS,
    },
    selected_ids: {
      type: [String],
      default: [],
    },
    is_undone: {
      type: Boolean,
      default: false,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dependencies: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
  },
  { timestamps: true },
)

const OperationLogModel = model<IOperationLogRaw>('OperationLog', OperationLogSchema)

export default OperationLogModel
