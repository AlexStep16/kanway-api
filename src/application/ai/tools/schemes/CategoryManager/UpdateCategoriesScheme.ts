import z from 'zod'
import { StringUpdateSchema } from '../updateSchemes.js'

export const UpdateColumnsScheme = z.object({
  selection_id: z.string().optional().describe('Apply updates to this selection of columns.'),
  column_ids: z
    .array(z.string())
    .optional()
    .describe('Apply updates to these specific columns only.'),

  updates: z.object({
    name: StringUpdateSchema.optional(),
  }),
}).describe(`
  Tool to update columns. You can specify a selection_id or multiple column_ids.
  For fields like 'name', you can either overwrite them with a flat value,
  or perform operations like appending text or prepending text.
`)

export type UpdateColumnsDTO = z.infer<typeof UpdateColumnsScheme>
