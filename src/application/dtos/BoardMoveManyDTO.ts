import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardMoveManyDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.BOARDS_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.BOARDS_BULK_UPDATE_INVALID),
  beforeBoardId: z
    .string(ErrorMessages.BEFORE_BOARD_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterBoardId: z
    .string(ErrorMessages.AFTER_BOARD_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  newWorkspaceId: z
    .string(ErrorMessages.WORKSPACE_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
})

export type BoardMoveManyDTO = z.infer<typeof BoardMoveManyDTOSchema>
