import { z } from 'zod'
import { TaskDTOSchema } from '@dtos/TaskDTO.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskEditDTOSchema = TaskDTOSchema.partial().extend({
  id: z.string(ErrorMessages.TASK_ID_INVALID).regex(objectIdRegex, ErrorMessages.TASK_ID_INVALID),
})

export type TaskEditDTO = z.infer<typeof TaskEditDTOSchema>
