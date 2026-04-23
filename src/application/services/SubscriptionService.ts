import SubscriptionRepository from '@repositories/SubscriptionRepository.js'
import { ISubscription } from '@entities/ISubscription.js'
import { SystemFields } from '@infrastructure/types/SystemFields.js'
import { BaseService } from './BaseService.js'
import { ISubscriptionRaw } from '@/domain/entities/ISubscriptionRaw.js'
import { ISubscriptionCriteria } from '../interfaces/criterias/ISubscriptionCriteria.js'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

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
    const subscription: ISubscription = {
      subscriptionId: data.subscriptionId,
      name: data.name,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      limitWorkspaces: data.limitWorkspaces,
      limitBoards: data.limitBoards,
    }

    await this.repository.create(subscription)
  }

  public async initSubscriptions() {
    await this.repository.deleteMany({})

    const subscriptionsData: Omit<ISubscription, SystemFields>[] = [
      {
        subscriptionId: SubscriptionPlanEnum.Basic,
        name: 'Базовый',
        price: 0,
        currency: 'RUB',
        interval: 'month',
        limitWorkspaces: 1,
        limitBoards: 5,
      },
      {
        subscriptionId: SubscriptionPlanEnum.Premium,
        name: 'Премиум',
        price: 999,
        currency: 'RUB',
        interval: 'month',
        limitWorkspaces: 5,
        limitBoards: 20,
      },
      {
        subscriptionId: SubscriptionPlanEnum.Architector,
        name: 'Архитектор',
        price: 2499,
        currency: 'RUB',
        interval: 'month',
        limitWorkspaces: -1,
        limitBoards: -1,
      },
    ]

    for (const subscription of subscriptionsData) {
      await this.create(subscription)
    }
  }
}
