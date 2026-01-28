import { z } from 'zod'
import { TaskDTOSchema } from '@dtos/TaskDTO.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { TASK_COLORS } from '@/constants/TASK_COLORS.ts'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskEditDTOSchema = TaskDTOSchema.partial().extend({
  id: z.string(ErrorMessages.TASK_ID_INVALID).regex(objectIdRegex, ErrorMessages.TASK_ID_INVALID),
  description: z
    .string(ErrorMessages.TASK_DESCRIPTION_INVALID)
    .max(300, ErrorMessages.TASK_DESCRIPTION_MORE_THAN_300)
    .nullable()
    .optional(),
  dueDate: z.iso.date(ErrorMessages.TASK_DUE_DATE_INVALID).nullable().optional(),
  dueHours: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(23).nullable().optional(),
  dueMinutes: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(59).nullable().optional(),
  color: z
    .enum(TASK_COLORS, {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.TASK_COLOR_REQUIRED
          : 'Неверное значение для цвета.',
    })
    .nullable()
    .optional(),
})

export type TaskEditDTO = z.infer<typeof TaskEditDTOSchema>
