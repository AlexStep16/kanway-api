import { Schema, model } from 'mongoose'
import { ICheckpointRaw } from '@entities/ICheckpointRaw.js'

const CheckpointSchema = new Schema<ICheckpointRaw>(
  {
    thread_id: {
      type: String,
      required: true,
    },
    checkpoint_ns: {
      type: String,
      required: true,
    },
    checkpoint_id: {
      type: String,
      required: true,
    },
    checkpoint: {
      type: Schema.Types.Mixed,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    parent_checkpoint_id: {
      type: String,
    },
  },
  { timestamps: true },
)

const Checkpoint = model<ICheckpointRaw>('Checkpoint', CheckpointSchema)

export default Checkpoint
