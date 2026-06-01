import z from 'zod'

export const RecoverTasksScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  task_ids: z.array(z.string()).optional().describe('Target task ids.'),
}).describe(`
  Recover tasks.
  Pass selection_id or task_ids.
`)

export type RecoverTasksDTO = z.infer<typeof RecoverTasksScheme>
