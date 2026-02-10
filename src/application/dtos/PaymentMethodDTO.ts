import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const PAYMENT_METHODS = [
  'bank_card',
  'apple_pay',
  'google_pay',
  'yoo_money',
  'qiwi',
  'webmoney',
  'sberbank',
  'alfabank',
  'tinkoff_bank',
  'b2b_sberbank',
  'sbp',
  'mobile_balance',
  'cash',
  'installments',
] as const

export const PaymentMethodDTOSchema = z.object({
  serviceId: z.string().min(1, ErrorMessages.PAYMENT_METHOD_SERVICE_ID_REQUIRED),
  paymentId: z.string().min(1, ErrorMessages.PAYMENT_METHOD_PAYMENT_ID_REQUIRED),
  type: z.enum(PAYMENT_METHODS, ErrorMessages.PAYMENT_METHOD_TYPE_INVALID),
  cardFirst6: z.string().length(6, ErrorMessages.PAYMENT_METHOD_CARD_FIRST6_INVALID).optional(),
  cardLast4: z.string().length(4, ErrorMessages.PAYMENT_METHOD_CARD_LAST4_INVALID).optional(),
  cardType: z.string().optional(),
  cardExpiryMonth: z.string().optional(),
  cardExpiryYear: z.string().optional(),
  phone: z.string().optional(),
  retriesCount: z.number().optional(),
  userId: z.string().min(1, ErrorMessages.USER_ID_REQUIRED),
})

export type PaymentMethodDTO = z.infer<typeof PaymentMethodDTOSchema>
