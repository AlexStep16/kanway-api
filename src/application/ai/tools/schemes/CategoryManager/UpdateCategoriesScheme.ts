import z from 'zod'
import { StringUpdateSchema } from '../updateSchemes.js'

export const UpdateCategoriesScheme = z.object({
  selection_id: z.string().optional().describe('Apply updates to this selection of categories.'),
  category_ids: z
    .array(z.string())
    .optional()
    .describe('Apply updates to these specific categories only.'),

  updates: z.object({
    name: StringUpdateSchema.optional(),
  }),
}).describe(`
  Tool to update categories. You can specify a selection_id or multiple category_ids.
  For fields like 'name', you can either overwrite them with a flat value,
  or perform operations like appending text or prepending text.
`)

export type UpdateCategoriesDTO = z.infer<typeof UpdateCategoriesScheme>
