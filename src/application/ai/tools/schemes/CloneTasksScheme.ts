import z from 'zod'

export const CloneTasksScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  task_ids: z.array(z.string()).optional().describe('Target task ids.'),
}).describe(`
  Clone tasks.
  Pass selection_id or task_ids.
`)

export type CloneTasksDTO = z.infer<typeof CloneTasksScheme>
