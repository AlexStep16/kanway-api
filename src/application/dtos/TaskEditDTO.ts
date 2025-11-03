import { z } from 'zod'
import { TaskDTOSchema } from '@/application/dtos/TaskDTO.ts'

export const TaskEditDTOSchema = TaskDTOSchema.partial()

export type TaskEditDTO = z.infer<typeof TaskEditDTOSchema>
