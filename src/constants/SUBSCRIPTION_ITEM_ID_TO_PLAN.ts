import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'

export const SUBSCRIPTION_ITEM_ID_TO_PLAN = {
  [PaymentItemIdEnum.BASIC]: SubscriptionPlanEnum.Basic,
  [PaymentItemIdEnum.PREMIUM]: SubscriptionPlanEnum.Premium,
  [PaymentItemIdEnum.ARCHITECTOR]: SubscriptionPlanEnum.Architector,
}
