import z from 'zod'

export const CloneCategoriesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  category_ids: z.array(z.string()).optional().describe('Target category ids.'),
}).describe(`
  Clone categories.
  Pass selection_id or category_ids.
`)

export type CloneCategoriesDTO = z.infer<typeof CloneCategoriesScheme>
