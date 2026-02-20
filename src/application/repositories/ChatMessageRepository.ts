import ChatMessage from '@models/ChatMessage.ts'
import { IChatMessageRaw } from '@/domain/entities/IChatMessageRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { IChatMessageCriteria } from '../interfaces/criterias/IChatMessageCriteria.ts'
import { FilterQuery, Types } from 'mongoose'
import { IChatMessage } from '@entities/IChatMessage.ts'

export default class ChatMessageRepository extends BaseRepository<
  IChatMessageRaw,
  IChatMessage,
  IChatMessageCriteria
> {
  constructor() {
    super(ChatMessage)
  }

  public buildFilter(
    criteria: IChatMessageCriteria,
    userId: Types.ObjectId,
  ): FilterQuery<IChatMessageRaw> {
    const filter: FilterQuery<IChatMessageRaw> = { user_id: userId }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.chatId) {
      filter.chat_id = criteria.chatId
    } else if (criteria.chatIds) {
      filter.chat_id = { $in: criteria.chatIds }
    }

    if (criteria.threadId) {
      filter.thread_id = criteria.threadId
    } else if (criteria.threadIds) {
      filter.thread_id = { $in: criteria.threadIds }
    }

    return filter
  }
}
