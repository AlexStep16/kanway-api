import Chat from '@models/Chat.js'
import { IChatRaw } from '@entities/IChatRaw.js'
import { BaseRepository } from '@repositories/BaseRepository.js'
import { IChatCriteria } from '@interfaces/criterias/IChatCriteria.js'
import { FilterQuery, Types } from 'mongoose'
import { IChat } from '@entities/IChat.js'

export default class ChatRepository extends BaseRepository<IChatRaw, IChat, IChatCriteria> {
  constructor() {
    super(Chat)
  }

  public buildFilter(criteria: IChatCriteria, userId?: Types.ObjectId): FilterQuery<IChatRaw> {
    const filter: FilterQuery<IChatRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

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
