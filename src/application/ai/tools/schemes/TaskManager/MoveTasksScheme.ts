import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'
import { checkColumnId } from '../commonSchemes.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const MoveTasksScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  task_ids: z.array(z.string()).optional().describe('Target task ids.'),
  beforeTaskId: z
    .string(ErrorMessages.BEFORE_TASK_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the task before which to move the selected tasks.'),
  afterTaskId: z
    .string(ErrorMessages.AFTER_TASK_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the task after which to move the selected tasks.'),
  newColumnId: z
    .string(ErrorMessages.COLUMN_ID_INVALID)
    .refine(checkColumnId, {
      message: 'Column ID does not exist.',
    })
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the new column to move the tasks to.'),
  toStart: z.boolean().optional().describe('Move to the start of the column.'),
  toEnd: z.boolean().optional().describe('Move to the end of the column.'),
}).describe(`
  Move tasks.
  Pass selection_id or task_ids.
`)

export type MoveTasksDTO = z.infer<typeof MoveTasksScheme>
