import z from 'zod'
import { checkBoardId } from '../commonSchemes.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const CreateColumnsScheme = z.object({
  columns: z.array(
    z.object({
      name: z.string().describe('The new name of the column.'),
      board_id: z
        .string(ErrorMessages.BOARD_ID_INVALID)
        .refine(checkBoardId, {
          message: 'Board ID does not exist.',
        })
        .describe('ID of the board to move the column into.'),
    }),
  ),
}).describe(`
  Tool to create columns. You can specify multiple columns to be created at once.
  Required fields are 'name' and 'board_id'.
`)

export type CreateColumnsDTO = z.infer<typeof CreateColumnsScheme>
