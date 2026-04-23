import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export const SUBSCRIPTION_PLAN_TO_CREDITS = {
  [SubscriptionPlanEnum.Basic]: 20,
  [SubscriptionPlanEnum.Premium]: 600,
  [SubscriptionPlanEnum.Architector]: 1300,
}
