import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'
import { PaymentDTOSchema } from './PaymentDTO.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const PaymentEditDTOSchema = PaymentDTOSchema.partial().extend({
  id: z
    .string(ErrorMessages.PAYMENT_ID_INVALID)
    .regex(objectIdRegex, ErrorMessages.PAYMENT_ID_INVALID),
})

export type PaymentEditDTO = z.infer<typeof PaymentEditDTOSchema>
