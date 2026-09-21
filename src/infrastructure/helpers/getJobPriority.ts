import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export function getJobPriority(subscriptionId: SubscriptionPlanEnum): number {
  switch (subscriptionId) {
    case SubscriptionPlanEnum.Architector:
      return 1
    case SubscriptionPlanEnum.Premium:
      return 5
    case SubscriptionPlanEnum.Basic:
    default:
      return 10
  }
}
