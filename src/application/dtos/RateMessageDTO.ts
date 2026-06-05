import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const RateMessageDTOSchema = z.object({
  rating: z.boolean(ErrorMessages.RATING_VALUE_INVALID),
})

export type RateMessageDTO = z.infer<typeof RateMessageDTOSchema>
