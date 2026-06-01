import z from 'zod'

export const DeleteArchiveTasksScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  task_ids: z.array(z.string()).optional().describe('Target task ids.'),
  soft_delete: z.boolean().describe('True: move to archive. False: hard delete.'),
}).describe(`
  Delete or archive tasks.
  Pass selection_id or task_ids.
  Use soft_delete for archive vs hard delete.
`)

export type DeleteArchiveTasksDTO = z.infer<typeof DeleteArchiveTasksScheme>
