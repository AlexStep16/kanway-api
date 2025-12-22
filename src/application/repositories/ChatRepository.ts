import Chat from '@models/Chat.ts'
import { IChatRaw } from '@entities/IChatRaw.ts'
import { BaseRepository } from '@repositories/BaseRepository.ts'
import { ChatCriteria } from '@interfaces/criterias/ChatCriteria.ts'
import { FilterQuery, Types } from 'mongoose'

export default class ChatRepository extends BaseRepository<IChatRaw, typeof Chat> {
  constructor() {
    super(Chat)
  }

  public buildFilter(criteria: ChatCriteria, userId: Types.ObjectId): FilterQuery<IChatRaw> {
    const filter: FilterQuery<IChatRaw> = { user_id: userId }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    if (criteria.threadId) {
      filter.thread_id = criteria.threadId
    } else if (criteria.threadIds) {
      filter.thread_id = { $in: criteria.threadIds }
    }

    if (criteria.workspaceId) {
      filter.workspace_id = criteria.workspaceId
    } else if (criteria.workspaceIds) {
      filter.workspace_id = { $in: criteria.workspaceIds }
    }

    return filter
  }
}
