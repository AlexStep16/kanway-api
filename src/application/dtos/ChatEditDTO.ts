import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const ChatEditDTOSchema = z.object({
  name: z
    .string(ErrorMessages.CHAT_NAME_INVALID)
    .min(1, ErrorMessages.CHAT_NAME_LESS_THAN_1)
    .max(100, ErrorMessages.CHAT_NAME_MORE_THAN_100)
    .optional(),
})

export type ChatEditDTO = z.infer<typeof ChatEditDTOSchema>
