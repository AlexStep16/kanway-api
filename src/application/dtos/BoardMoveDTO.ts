import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardMoveDTOSchema = z.object({
  id: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex),
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
})

export type BoardMoveDTO = z.infer<typeof BoardMoveDTOSchema>
