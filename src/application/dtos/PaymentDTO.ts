import { PaymentStatusEnum } from '@domain/enums/PaymentStatusEnum.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const PaymentDTOSchema = z.object({
  description: z
    .string()
    .min(1, ErrorsMessage.PAYMENT_DESCRIPTION_TOO_SHORT)
    .max(255, ErrorsMessage.PAYMENT_DESCRIPTION_TOO_LONG),
  amount: z.number().min(0.01, ErrorsMessage.PAYMENT_AMOUNT_TOO_SMALL),
  currency: z.string().length(3, ErrorsMessage.PAYMENT_CURRENCY_INVALID),
  status: z.enum(PaymentStatusEnum, {
    error: () => ({ message: ErrorsMessage.PAYMENT_STATUS_INVALID }),
  }),
})

export type PaymentDTO = z.infer<typeof PaymentDTOSchema>
