import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const UpdateChatNameDTOSchema = z.object({
  userMessage: z.string(ErrorMessages.MESSAGE_TYPE_INVALID),
})

export type UpdateChatNameDTO = z.infer<typeof UpdateChatNameDTOSchema>
