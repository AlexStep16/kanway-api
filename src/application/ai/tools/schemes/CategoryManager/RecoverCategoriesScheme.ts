import z from 'zod'

export const RecoverCategoriesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  category_ids: z.array(z.string()).optional().describe('Target category ids.'),
}).describe(`
  Recover categories.
  Pass selection_id or category_ids.
`)

export type RecoverCategoriesDTO = z.infer<typeof RecoverCategoriesScheme>
