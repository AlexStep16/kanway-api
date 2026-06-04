import z from 'zod'
import { StringUpdateSchema } from '../updateSchemes.js'

export const UpdateBoardsScheme = z.object({
  selection_id: z.string().optional().describe('Apply updates to this selection of boards.'),
  board_ids: z
    .array(z.string())
    .optional()
    .describe('Apply updates to these specific boards only.'),

  updates: z.object({
    name: StringUpdateSchema.optional(),
    is_favorite: z.boolean().optional(),
  }),
}).describe(`
  Tool to update boards. You can specify a selection_id or multiple board_ids.
  For fields like 'name', you can either overwrite them with a flat value,
  or perform operations like appending text or prepending text.
`)

export type UpdateBoardsDTO = z.infer<typeof UpdateBoardsScheme>
