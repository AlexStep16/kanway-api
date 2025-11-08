import { z } from 'zod'
import { TaskEditDTOSchema } from '@dtos/TaskEditDTO.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'

export const TaskEditManyDTOSchema = z.array(TaskEditDTOSchema, {
  error: ErrorsMessage.TASKS_BULK_UPDATE_INVALID,
})

export type TaskEditManyDTO = z.infer<typeof TaskEditManyDTOSchema>
