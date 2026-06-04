import { z } from 'zod'

export const UndoOperationsScheme = z.object({
  log_ids: z.array(z.string()).describe('List of log IDs to undo.'),
}).describe(`
  Tool for undoing operations based on log IDs.
`)

export type UndoOperationsDTO = z.infer<typeof UndoOperationsScheme>
