import z from 'zod'

export const DeleteArchiveColumnsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  column_ids: z.array(z.string()).optional().describe('Target column ids.'),
  soft_delete: z.boolean().describe('True: move to archive. False: hard delete.'),
}).describe(`
  Delete or archive columns.
  Pass selection_id or column_ids.
  Use soft_delete for archive vs hard delete.
`)

export type DeleteArchiveColumnsDTO = z.infer<typeof DeleteArchiveColumnsScheme>
