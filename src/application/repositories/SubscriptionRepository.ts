import SubscriptionModel from '@/domain/models/SubscriptionModel.ts'
import { ISubscriptionRaw } from '@/domain/entities/ISubscriptionRaw.ts'
import { BaseRepository } from './BaseRepository.ts'
import { ISubscription } from '@/domain/entities/ISubscription.ts'
import { ISubscriptionCriteria } from '../interfaces/criterias/ISubscriptionCriteria.ts'
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
