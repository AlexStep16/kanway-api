import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.ts'
import SubscriptionRepository from '@repositories/SubscriptionRepository.ts'
import { SubscriptionService } from '@application/services/SubscriptionService.ts'
import Subscription from './domain/models/SubscriptionModel.ts'
import { ISubscription } from './domain/entities/ISubscription.ts'

const subscriptions: ISubscription[] = [
  {
    id: SubscriptionPlanEnum.Basic,
    name: 'Basic',
    price: 0,
    currency: 'RUB',
    interval: 'month',
    limitWorkspaces: 1,
    limitBoards: 5,
    limitAiMessagesPerMonth: 20,
  },
  {
    id: SubscriptionPlanEnum.Pro,
    name: 'Pro',
    price: 599,
    currency: 'RUB',
    interval: 'month',
    limitWorkspaces: 9999,
    limitBoards: 9999,
    limitAiMessagesPerMonth: 300,
  },
  {
    id: SubscriptionPlanEnum.Business,
    name: 'Business',
    price: 999,
    currency: 'RUB',
    interval: 'month',
    limitWorkspaces: 9999,
    limitBoards: 9999,
    limitAiMessagesPerMonth: 9999,
  },
]

export async function initSubscriptions(): Promise<void> {
  const existingSubscriptions = await Subscription.find().lean()
  const subscriptionRepository = new SubscriptionRepository()
  const subscriptionService = new SubscriptionService(subscriptionRepository)

  if (existingSubscriptions.length === 0) {
    for (const subscriptionData of subscriptions) {
      await subscriptionService.create(subscriptionData)
    }
  }
}
