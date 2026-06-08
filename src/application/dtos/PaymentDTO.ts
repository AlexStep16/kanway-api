import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { PaymentStatusesEnum } from '@/domain/enums/PaymentStatusesEnum.js'
import { z } from 'zod'
import { PaymentTypeEnum } from '@/domain/enums/PaymentTypeEnum.js'
import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'

export const PaymentDTOSchema = z.object({
  serviceId: z.string().min(1, ErrorMessages.PAYMENT_SERVICE_ID_REQUIRED),
  column: z.enum(PaymentTypeEnum, {
    error: () => ({ message: ErrorMessages.PAYMENT_TYPE_INVALID }),
  }),
  itemId: z.enum(PaymentItemIdEnum, {
    error: () => ({ message: ErrorMessages.SUBSCRIPTION_PLAN_INVALID }),
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
