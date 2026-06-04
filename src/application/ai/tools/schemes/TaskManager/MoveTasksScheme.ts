import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'

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
  newCategoryId: z
    .string(ErrorMessages.CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .optional()
    .describe('ID of the new category to move the tasks to.'),
  toStart: z.boolean().optional().describe('Move to the start of the category.'),
  toEnd: z.boolean().optional().describe('Move to the end of the category.'),
}).describe(`
  Move tasks.
  Pass selection_id or task_ids.
`)

export type MoveTasksDTO = z.infer<typeof MoveTasksScheme>
