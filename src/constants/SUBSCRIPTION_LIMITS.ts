import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export const SUBSCRIPTION_LIMITS = {
  [SubscriptionPlanEnum.Basic]: {
    workspaces: 1,
    boards: 5,
  },
  [SubscriptionPlanEnum.Premium]: {
    workspaces: 5,
    boards: 20,
  },
  [SubscriptionPlanEnum.Architector]: {
    workspaces: Infinity,
    boards: Infinity,
  },
}
