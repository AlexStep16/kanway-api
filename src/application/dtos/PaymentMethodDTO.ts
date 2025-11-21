import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const PaymentMethodDTOSchema = z.object({
  serviceId: z.string().min(1, ErrorsMessage.PAYMENT_METHOD_SERVICE_ID_REQUIRED),
  type: z.string().min(1, ErrorsMessage.PAYMENT_METHOD_TYPE_REQUIRED),
  cardFirst6: z.string().length(6, ErrorsMessage.PAYMENT_METHOD_CARD_FIRST6_INVALID),
  cardLast4: z.string().length(4, ErrorsMessage.PAYMENT_METHOD_CARD_LAST4_INVALID),
  cardType: z.string().min(1, ErrorsMessage.PAYMENT_METHOD_CARD_TYPE_REQUIRED),
  last4: z.string().length(4, ErrorsMessage.PAYMENT_METHOD_LAST4_INVALID),
  expiryMonth: z
    .number()
    .min(1, ErrorsMessage.PAYMENT_METHOD_EXPIRY_MONTH_INVALID)
    .max(12, ErrorsMessage.PAYMENT_METHOD_EXPIRY_MONTH_INVALID),
  expiryYear: z.number().min(2023, ErrorsMessage.PAYMENT_METHOD_EXPIRY_YEAR_INVALID),
  userId: z.string().min(1, ErrorsMessage.PAYMENT_USER_ID_REQUIRED),
})

export type PaymentMethodDTO = z.infer<typeof PaymentMethodDTOSchema>
