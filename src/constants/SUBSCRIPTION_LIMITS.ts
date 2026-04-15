import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export const SUBSCRIPTION_LIMITS = {
  [SubscriptionPlanEnum.Basic]: {
    workspaces: 1,
    boards: 5,
    aiMessages: 20,
  },
  [SubscriptionPlanEnum.Premium]: {
    workspaces: Infinity,
    boards: Infinity,
    aiMessages: 300,
  },
  [SubscriptionPlanEnum.Business]: {
    workspaces: Infinity,
    boards: Infinity,
    aiMessages: Infinity,
  },
}
