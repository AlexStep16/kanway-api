import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export const SUBSCRIPTION_PLAN_TO_CREDITS = {
  [SubscriptionPlanEnum.Basic]: 200,
  [SubscriptionPlanEnum.Premium]: 10000,
  [SubscriptionPlanEnum.Architector]: 25000,
}
