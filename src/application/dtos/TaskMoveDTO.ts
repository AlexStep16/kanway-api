import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskMoveDTOSchema = z.object({
  id: z.string(ErrorMessages.TASK_ID_INVALID).regex(objectIdRegex),
  beforeId: z
    .string(ErrorMessages.BEFORE_TASK_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
  afterId: z.string(ErrorMessages.AFTER_TASK_ID_INVALID).regex(objectIdRegex).nullable().optional(),
  newCategoryId: z
    .string(ErrorMessages.CATEGORY_ID_INVALID)
    .regex(objectIdRegex)
    .nullable()
    .optional(),
})

export type TaskMoveDTO = z.infer<typeof TaskMoveDTOSchema>
