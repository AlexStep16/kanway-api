import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'
import { CreateTaskDTOSchema } from './CreateTasksDTO.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const UpdateTaskDTOSchema = CreateTaskDTOSchema.partial()
  .extend({
    _id: z
      .string(ErrorMessages.TASK_ID_INVALID)
      .regex(objectIdRegex, ErrorMessages.TASK_ID_INVALID),
  })
  .strict()

export const UpdateTasksDTOSchema = z.object({
  updates: UpdateTaskDTOSchema.array(),
})

export type UpdateTasksDTO = z.infer<typeof UpdateTasksDTOSchema>
