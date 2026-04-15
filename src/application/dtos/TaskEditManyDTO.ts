import { z } from 'zod'
import { TaskEditDTOSchema } from '@dtos/TaskEditDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'

export const TaskEditManyDTOSchema = z.array(TaskEditDTOSchema, {
  error: ErrorMessages.TASKS_BULK_UPDATE_INVALID,
})

export type TaskEditManyDTO = z.infer<typeof TaskEditManyDTOSchema>
