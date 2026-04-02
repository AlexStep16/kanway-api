import { Schema, model } from 'mongoose'
import { ICheckpointWriteRaw } from '@entities/ICheckpointWriteRaw.ts'

const CheckpointWriteSchema = new Schema<ICheckpointWriteRaw>(
  {
    idx: {
      type: Number,
      required: true,
    },
    task_id: {
      type: String,
      required: true,
    },
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
    channel: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
)

const CheckpointWrite = model<ICheckpointWriteRaw>('checkpoint_writes', CheckpointWriteSchema)

export default CheckpointWrite
