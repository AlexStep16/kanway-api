import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TrelloImportJsonDTOSchema = z
  .object({
    board: z.record(z.string(), z.any(), {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.TRELLO_BOARD_JSON_REQUIRED
          : ErrorMessages.TRELLO_BOARD_JSON_INVALID,
    }),
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

export type TrelloImportJsonDTO = z.infer<typeof TrelloImportJsonDTOSchema>
