import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskReorderDTOSchema = z.object({
  ids: z
    .array(z.string(ErrorMessages.TASK_ID_INVALID).regex(objectIdRegex), {
      error: ErrorMessages.TASKS_BULK_UPDATE_INVALID,
    })
    .min(1, ErrorMessages.TASKS_BULK_UPDATE_INVALID),
  columnId: z.string(ErrorMessages.COLUMN_ID_INVALID).regex(objectIdRegex),
})

export type TaskReorderDTO = z.infer<typeof TaskReorderDTOSchema>
