import { Schema, model } from 'mongoose'
import { ISelectionRaw } from '../entities/ISelectionRaw.js'
import { EntityTypesEnum } from '../enums/EntityTypesEnum.js'

const SelectionSchema = new Schema<ISelectionRaw>(
  {
    entity_type: {
      type: String,
      enum: EntityTypesEnum,
      required: true,
    },
    entity_ids: {
      type: [Schema.Types.ObjectId],
      required: true,
    },
    human_readable_filters: {
      type: [
        {
          text: { type: String, required: true },
          value: { type: String },
        },
      ],
      required: true,
    },
    sample: {
      type: Schema.Types.Mixed,
      required: true,
    },
    count: {
      type: Number,
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

const Selection = model<ISelectionRaw>('Selection', SelectionSchema)

export default Selection
