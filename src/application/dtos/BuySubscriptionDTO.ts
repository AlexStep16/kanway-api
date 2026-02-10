import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.ts'
import { z } from 'zod'

export const BuySubscriptionDTOSchema = z.object({
  subscriptionId: z.enum(SubscriptionPlanEnum, {
    error: () => ({ message: ErrorMessages.SUBSCRIPTION_PLAN_INVALID }),
  }),
})

export type BuySubscriptionDTO = z.infer<typeof BuySubscriptionDTOSchema>
