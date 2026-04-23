import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'
import { PaymentItemIdEnum } from '@/domain/enums/PaymentItemIdEnum.js'

export const BuyCreditsDTOSchema = z.object({
  itemId: z.enum(PaymentItemIdEnum, {
    error: () => ({ message: ErrorMessages.CREDIT_ITEM_NOT_FOUND }),
  }),
})

export type BuyCreditsDTO = z.infer<typeof BuyCreditsDTOSchema>
