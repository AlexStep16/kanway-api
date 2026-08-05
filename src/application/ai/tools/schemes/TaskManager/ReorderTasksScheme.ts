import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const ReorderTasksScheme = z.object({
  column_id: z
    .string(ErrorMessages.COLUMN_ID_INVALID)
    .regex(objectIdRegex)
    .describe('ID of the column where tasks are being reordered.'),
  selection_id: z.string().optional().describe('Target selection id.'),
  task_ids: z
    .array(z.string())
    .describe(
      'The complete list of ALL task IDs in this column, ordered in the exact sequence they should appear',
    ),
}).describe(`
  Reorder all tasks in a specific column. 
  Pass the complete list of task IDs in the desired target order.
`)

export type ReorderTasksDTO = z.infer<typeof ReorderTasksScheme>
