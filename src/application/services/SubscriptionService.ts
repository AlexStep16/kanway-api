import SubscriptionRepository from '@repositories/SubscriptionRepository.js'
import { ISubscription } from '@entities/ISubscription.js'
import { SystemFields } from '@infrastructure/types/SystemFields.js'
import { BaseService } from './BaseService.js'
import { ISubscriptionRaw } from '@/domain/entities/ISubscriptionRaw.js'
import { ISubscriptionCriteria } from '../interfaces/criterias/ISubscriptionCriteria.js'

export class SubscriptionService extends BaseService<
  ISubscriptionRaw,
  ISubscription,
  ISubscriptionCriteria
> {
  protected repository: SubscriptionRepository

  constructor(subscriptionRepository: SubscriptionRepository) {
    super(subscriptionRepository)

    this.repository = subscriptionRepository
  }

  public async create(data: ISubscription): Promise<void> {
    const subscription: Omit<ISubscription, SystemFields> = {
      name: data.name,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      limitWorkspaces: data.limitWorkspaces,
      limitBoards: data.limitBoards,
    }

    await this.repository.create(subscription)
  }
}
