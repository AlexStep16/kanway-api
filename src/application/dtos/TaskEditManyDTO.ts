import { z } from 'zod'
import { TaskEditDTOSchema } from '@dtos/TaskEditDTO.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'

export const TaskEditManyDTOSchema = z.array(TaskEditDTOSchema, {
  error: ErrorMessages.TASKS_BULK_UPDATE_INVALID,
})

export type TaskEditManyDTO = z.infer<typeof TaskEditManyDTOSchema>
