import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { SubscriptionPlanEnum } from '@/domain/enums/SubscriptionPlanEnum.js'
import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.js'
import { z } from 'zod'

export const PaymentDTOSchema = z.object({
  serviceId: z.string().min(1, ErrorMessages.PAYMENT_SERVICE_ID_REQUIRED),
  type: z.enum(SubscriptionPlanEnum, {
    error: () => ({ message: ErrorMessages.PAYMENT_TYPE_INVALID }),
  }),
  description: z
    .string()
    .min(1, ErrorMessages.PAYMENT_DESCRIPTION_TOO_SHORT)
    .max(255, ErrorMessages.PAYMENT_DESCRIPTION_TOO_LONG),
  amount: z.string().min(1, ErrorMessages.PAYMENT_AMOUNT_REQUIRED),
  currency: z.string().length(3, ErrorMessages.PAYMENT_CURRENCY_INVALID),
  status: z.enum(PaymentStatusesEnum, {
    error: () => ({ message: ErrorMessages.PAYMENT_STATUS_INVALID }),
  }),
})

export type PaymentDTO = z.infer<typeof PaymentDTOSchema>
