import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardReorderDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.BOARDS_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.BOARDS_BULK_UPDATE_INVALID),
  workspaceId: z.string(ErrorMessages.WORKSPACE_ID_INVALID).regex(objectIdRegex),
})

export type BoardReorderDTO = z.infer<typeof BoardReorderDTOSchema>
