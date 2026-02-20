import { Schema, model } from 'mongoose'
import { IChatMessageRaw } from '@entities/IChatMessageRaw.ts'

const ChatMessageSchema = new Schema<IChatMessageRaw>(
  {
    role: {
      type: String,
      required: true,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    list_type: {
      type: String,
      required: false,
    },
    chat_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    thread_id: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
)

const ChatMessage = model<IChatMessageRaw>('ChatMessage', ChatMessageSchema)

export default ChatMessage
