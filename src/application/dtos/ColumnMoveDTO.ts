import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ColumnMoveDTOSchema = z.object({
  id: z.string(ErrorMessages.COLUMN_ID_INVALID).regex(objectIdRegex),
  beforeId: z
    .string(ErrorMessages.BEFORE_COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterId: z
    .string(ErrorMessages.AFTER_COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  newBoardId: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex).nullable().optional(),
})

export type ColumnMoveDTO = z.infer<typeof ColumnMoveDTOSchema>
