import z from 'zod'

export const DeleteArchiveBoardsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  board_ids: z.array(z.string()).optional().describe('Target board ids.'),
  soft_delete: z.boolean().describe('True: move to archive. False: hard delete.'),
}).describe(`
  Delete or archive boards.
  Pass selection_id or board_ids.
  Use soft_delete for archive vs hard delete.
`)

export type DeleteArchiveBoardsDTO = z.infer<typeof DeleteArchiveBoardsScheme>
