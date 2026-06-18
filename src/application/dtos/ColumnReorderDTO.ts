import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ColumnReorderDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.COLUMN_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.COLUMNS_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.COLUMNS_BULK_UPDATE_INVALID),
  boardId: z.string(ErrorMessages.BOARD_ID_INVALID).regex(objectIdRegex),
})

export type ColumnReorderDTO = z.infer<typeof ColumnReorderDTOSchema>
