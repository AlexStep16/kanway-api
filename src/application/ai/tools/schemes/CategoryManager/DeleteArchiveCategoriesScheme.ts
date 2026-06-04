import z from 'zod'

export const DeleteArchiveCategoriesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  category_ids: z.array(z.string()).optional().describe('Target category ids.'),
  soft_delete: z.boolean().describe('True: move to archive. False: hard delete.'),
}).describe(`
  Delete or archive categories.
  Pass selection_id or category_ids.
  Use soft_delete for archive vs hard delete.
`)

export type DeleteArchiveCategoriesDTO = z.infer<typeof DeleteArchiveCategoriesScheme>
