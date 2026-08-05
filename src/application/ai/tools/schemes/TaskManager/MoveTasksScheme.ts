import { ErrorMessages } from '@/enums/ErrorMessages.js'
import z from 'zod'
import { checkColumnId } from '../commonSchemes.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const MoveTasksScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  task_ids: z.array(z.string()).optional().describe('Target task ids.'),
  beforeTaskId: z.string(ErrorMessages.BEFORE_TASK_ID_INVALID).regex(objectIdRegex).optional(),
  afterTaskId: z.string(ErrorMessages.AFTER_TASK_ID_INVALID).regex(objectIdRegex).optional(),
  newColumnId: z
    .string(ErrorMessages.COLUMN_ID_INVALID)
    .refine(checkColumnId, {
      message: 'Column ID does not exist',
    })
    .regex(objectIdRegex)
    .optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
}).describe(`
  Move tasks.
  Pass selection_id or task_ids.
`)

export type MoveTasksDTO = z.infer<typeof MoveTasksScheme>
