import z from 'zod'

export const CloneColumnsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  column_ids: z.array(z.string()).optional().describe('Target column ids.'),
}).describe(`
  Clone columns.
  Pass selection_id or column_ids.
`)

export type CloneColumnsDTO = z.infer<typeof CloneColumnsScheme>
