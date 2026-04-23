import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export const SUBSCRIPTION_PLAN_TO_ITEM_ID = {
  [SubscriptionPlanEnum.Basic]: PaymentItemIdEnum.BASIC,
  [SubscriptionPlanEnum.Premium]: PaymentItemIdEnum.PREMIUM,
  [SubscriptionPlanEnum.Architector]: PaymentItemIdEnum.ARCHITECTOR,
}
