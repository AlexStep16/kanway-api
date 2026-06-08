import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskMoveManyDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.TASK_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.TASKS_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.TASKS_BULK_UPDATE_INVALID),
  beforeTaskId: z
    .string(ErrorMessages.BEFORE_TASK_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterTaskId: z
    .string(ErrorMessages.AFTER_TASK_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  newColumnId: z.string(ErrorMessages.COLUMN_ID_INVALID).regex(objectIdRegex).nullable().optional(),
  toStart: z.boolean().optional(),
  toEnd: z.boolean().optional(),
})

export type TaskMoveManyDTO = z.infer<typeof TaskMoveManyDTOSchema>
