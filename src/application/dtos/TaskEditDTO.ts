import { z } from 'zod'
import { TaskDTOSchema } from '@dtos/TaskDTO.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskEditDTOSchema = TaskDTOSchema.partial().extend({
  id: z.string(ErrorsMessage.TASK_ID_INVALID).regex(objectIdRegex, ErrorsMessage.TASK_ID_INVALID),
})

export type TaskEditDTO = z.infer<typeof TaskEditDTOSchema>
