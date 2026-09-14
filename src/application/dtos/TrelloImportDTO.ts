import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TrelloImportDTOSchema = z
  .object({
    // Omitted/empty boardIds means "import all boards available for this token"
    boardIds: z.array(z.string().min(1), ErrorMessages.TRELLO_BOARD_ID_INVALID).optional(),
    token: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TRELLO_TOKEN_REQUIRED
            : ErrorMessages.TRELLO_TOKEN_INVALID,
      })
      .min(1, ErrorMessages.TRELLO_TOKEN_INVALID),
    workspaceId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
  })
  .strict()

export type TrelloImportDTO = z.infer<typeof TrelloImportDTOSchema>
