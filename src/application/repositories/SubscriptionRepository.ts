import SubscriptionModel from '@/domain/models/SubscriptionModel.js'
import { ISubscriptionRaw } from '@/domain/entities/ISubscriptionRaw.js'
import { BaseRepository } from './BaseRepository.js'
import { ISubscription } from '@/domain/entities/ISubscription.js'
import { ISubscriptionCriteria } from '../interfaces/criterias/ISubscriptionCriteria.js'
import { FilterQuery, Types } from 'mongoose'

export default class SubscriptionRepository extends BaseRepository<
  ISubscriptionRaw,
  ISubscription,
  ISubscriptionCriteria
> {
  constructor() {
    super(SubscriptionModel)
  }

  public buildFilter(
    criteria: ISubscriptionCriteria,
    userId?: Types.ObjectId,
  ): FilterQuery<ISubscriptionRaw> {
    const filter: FilterQuery<ISubscriptionRaw> = {}

    if (userId) {
      filter.user_id = userId
    }

    if (criteria.id) {
      filter._id = criteria.id
    } else if (criteria.ids) {
      filter._id = { $in: criteria.ids }
    }

    return filter
  }
}
