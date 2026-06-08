import z from 'zod'

export const RecoverColumnsScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  column_ids: z.array(z.string()).optional().describe('Target column ids.'),
}).describe(`
  Recover columns.
  Pass selection_id or column_ids.
`)

export type RecoverColumnsDTO = z.infer<typeof RecoverColumnsScheme>
