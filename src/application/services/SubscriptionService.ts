import { toServerCaseKeys } from '@utils/objectTransformers.ts'
import SubscriptionRepository from '@repositories/SubscriptionRepository.ts'
import { ISubscriptionRaw } from '@entities/ISubscriptionRaw.ts'
import { ISubscription } from '@entities/ISubscription.ts'
import { SystemFields } from '@infrastructure/types/SystemFields.ts'

export class SubscriptionService {
  protected repository: SubscriptionRepository

  constructor(subscriptionRepository: SubscriptionRepository) {
    this.repository = subscriptionRepository
  }

  public async create(data: ISubscription): Promise<void> {
    const subscription: Omit<ISubscriptionRaw, SystemFields> = {
      id: data.id,
      name: data.name,
      price: data.price,
      currency: data.currency,
      interval: data.interval,
      limit_workspaces: data.limitWorkspaces,
      limit_boards: data.limitBoards,
      limit_ai_messages_per_month: data.limitAiMessagesPerMonth,
    }

    await this.repository.create(subscription)
  }

  public async getAll(): Promise<ISubscription[]> {
    const subscriptions = await this.repository.findAll()

    return subscriptions.map(toServerCaseKeys<ISubscription>)
  }

  public async getById(id: string): Promise<ISubscription | null> {
    const subscription = await this.repository.findById(id)

    return toServerCaseKeys<ISubscription>(subscription)
  }
}
