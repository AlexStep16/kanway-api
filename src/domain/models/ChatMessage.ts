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
    },
    pending_tool_call_id: {
      type: String,
    },
    chat_id: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    credits_used: {
      type: Number,
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
