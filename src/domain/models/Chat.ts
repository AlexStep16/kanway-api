import { Schema, model } from 'mongoose'
import { IChatRaw } from '@entities/IChatRaw.ts'

const ChatSchema = new Schema<IChatRaw>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    thread_id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
)

const Chat = model<IChatRaw>('Chat', ChatSchema)

export default Chat
