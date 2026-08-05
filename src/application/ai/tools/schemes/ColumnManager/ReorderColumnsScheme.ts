import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ReorderColumnsScheme = z.object({
  board_id: z
    .string(ErrorMessages.BOARD_ID_INVALID)
    .regex(objectIdRegex)
    .describe('ID of the board where columns are being reordered.'),
  selection_id: z.string().optional().describe('Target selection id.'),
  column_ids: z
    .array(z.string())
    .describe(
      'The complete list of ALL column IDs on this board, ordered in the exact sequence they should appear',
    ),
}).describe(`
  Reorder all columns on a specific board. 
  Pass the complete list of column IDs in the desired target order.
`)

export type ReorderColumnsDTO = z.infer<typeof ReorderColumnsScheme>
