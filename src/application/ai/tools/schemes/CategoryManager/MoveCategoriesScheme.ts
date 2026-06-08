import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'
import { checkBoardId } from '../commonSchemes.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const MoveColumnsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  column_ids: z.array(z.string()).optional().describe('Target column ids.'),
  beforeColumnId: z
    .string(ErrorMessages.BEFORE_COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the column before which to move the selected columns.'),
  afterColumnId: z
    .string(ErrorMessages.AFTER_COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the column after which to move the selected columns.'),
  newBoardId: z
    .string(ErrorMessages.BOARD_ID_INVALID)
    .refine(checkBoardId, {
      message: 'Board ID does not exist.',
    })
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the new board to move the columns to.'),
  toStart: z.boolean().optional().describe('Move to the start of the column.'),
  toEnd: z.boolean().optional().describe('Move to the end of the column.'),
}).describe(`
  Move columns.
  Pass selection_id or column_ids.
`)

export type MoveColumnsDTO = z.infer<typeof MoveColumnsScheme>
