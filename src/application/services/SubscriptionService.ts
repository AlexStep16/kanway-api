import SubscriptionRepository from '@repositories/SubscriptionRepository.ts'
import { ISubscription } from '@entities/ISubscription.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'
import { BaseService } from './BaseService.ts'
import { ISubscriptionRaw } from '@/domain/entities/ISubscriptionRaw.ts'
import { ISubscriptionCriteria } from '../interfaces/criterias/ISubscriptionCriteria.ts'

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
