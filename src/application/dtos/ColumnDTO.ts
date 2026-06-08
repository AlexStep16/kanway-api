import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ColumnDTOSchema = z
  .object({
    id: z.string(ErrorMessages.COLUMN_ID_INVALID).optional(),
    name: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.COLUMN_NAME_REQUIRED
            : ErrorMessages.COLUMN_NAME_INVALID,
      })
      .min(1, ErrorMessages.COLUMN_NAME_LESS_THAN_1)
      .max(100, ErrorMessages.COLUMN_NAME_MORE_THAN_100),
    boardId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.BOARD_ID_REQUIRED
            : ErrorMessages.BOARD_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
  })
  .strict()

export type ColumnDTO = z.infer<typeof ColumnDTOSchema>
