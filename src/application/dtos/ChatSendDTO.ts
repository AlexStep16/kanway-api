import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ChatSendDTOSchema = z.object({
  id: z
    .string(ErrorMessages.INVALID_ID_FORMAT)
    .regex(objectIdRegex, ErrorMessages.INVALID_ID_FORMAT)
    .optional(),
  message: z.string(ErrorMessages.MESSAGE_TYPE_INVALID).optional(),
  chatId: z.string(ErrorMessages.CHAT_ID_INVALID).optional(),
  threadId: z.string(ErrorMessages.THREAD_ID_INVALID).optional(),
  boardId: z
    .string({
      error: (iss) =>
        iss.input === undefined ? ErrorMessages.BOARD_ID_REQUIRED : ErrorMessages.BOARD_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
  workspaceId: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_ID_REQUIRED
          : ErrorMessages.WORKSPACE_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
  timezone: z.string(ErrorMessages.INVALID_TIMEZONE),
})

export type ChatSendDTO = z.infer<typeof ChatSendDTOSchema>
