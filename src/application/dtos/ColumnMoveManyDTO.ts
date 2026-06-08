import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ColumnMoveManyDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.COLUMN_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.COLUMNS_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.COLUMNS_BULK_UPDATE_INVALID),
  beforeColumnId: z
    .string(ErrorMessages.BEFORE_COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterColumnId: z
    .string(ErrorMessages.AFTER_COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  newBoardId: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex).nullable().optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
})

export type ColumnMoveManyDTO = z.infer<typeof ColumnMoveManyDTOSchema>
