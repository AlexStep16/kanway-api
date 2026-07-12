import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'
import { SubscriptionPlanPricesEnum } from '@/domain/enums/SubscriptionPlanPricesEnum.js'

export const SUBSCRIPTION_PLAN_PRICES: Record<SubscriptionPlanEnum, number> = {
  [SubscriptionPlanEnum.Basic]: 0,
  [SubscriptionPlanEnum.Premium]: SubscriptionPlanPricesEnum.Premium,
  [SubscriptionPlanEnum.Architector]: SubscriptionPlanPricesEnum.Architector,
}
