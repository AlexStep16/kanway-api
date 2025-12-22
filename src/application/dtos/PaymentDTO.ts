import { PaymentStatusEnum } from '@domain/enums/PaymentStatusEnum.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

export const PaymentDTOSchema = z.object({
  description: z
    .string()
    .min(1, ErrorMessages.PAYMENT_DESCRIPTION_TOO_SHORT)
    .max(255, ErrorMessages.PAYMENT_DESCRIPTION_TOO_LONG),
  amount: z.number().min(0.01, ErrorMessages.PAYMENT_AMOUNT_TOO_SMALL),
  currency: z.string().length(3, ErrorMessages.PAYMENT_CURRENCY_INVALID),
  status: z.enum(PaymentStatusEnum, {
    error: () => ({ message: ErrorMessages.PAYMENT_STATUS_INVALID }),
  }),
})

export type PaymentDTO = z.infer<typeof PaymentDTOSchema>
