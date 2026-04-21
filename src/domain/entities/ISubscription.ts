import { SubscriptionPlanEnum } from '@domain/enums/SubscriptionPlanEnum.js'

export interface ISubscription {
  subscriptionId: SubscriptionPlanEnum
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  limitWorkspaces: number
  limitBoards: number
}
