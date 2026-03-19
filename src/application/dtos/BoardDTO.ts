import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardDTOSchema = z.object({
  id: z.string(ErrorMessages.BOARD_ID_INVALID).optional(),
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.BOARD_NAME_REQUIRED
          : ErrorMessages.BOARD_NAME_INVALID,
    })
    .min(1, ErrorMessages.BOARD_NAME_LESS_THAN_1)
    .max(100, ErrorMessages.BOARD_NAME_MORE_THAN_100),
  workspaceId: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_ID_REQUIRED
          : ErrorMessages.WORKSPACE_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
  isFavorite: z.boolean(ErrorMessages.BOARD_IS_FAVORITE_TYPE_INVALID).optional(),
})

export type BoardDTO = z.infer<typeof BoardDTOSchema>
