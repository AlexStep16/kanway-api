import { z } from 'zod'
import { TaskDTOSchema } from '@dtos/TaskDTO.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskEditDTOSchema = TaskDTOSchema.partial().extend({
  id: z.string(ErrorMessages.TASK_ID_INVALID).regex(objectIdRegex, ErrorMessages.TASK_ID_INVALID),
  description: z
    .string(ErrorMessages.TASK_DESCRIPTION_INVALID)
    .max(16384, ErrorMessages.TASK_DESCRIPTION_TOO_LONG)
    .nullable()
    .optional(),
  dueDate: z.iso.date(ErrorMessages.TASK_DUE_DATE_INVALID).nullable().optional(),
  dueHours: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(23).nullable().optional(),
  dueMinutes: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(59).nullable().optional(),
  priority: z
    .enum(['low', 'medium', 'high'], {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.TASK_PRIORITY_REQUIRED
          : ErrorMessages.TASK_PRIORITY_INVALID,
    })
    .nullable()
    .optional(),
  color: z
    .object({
      value: z.enum(TASK_COLORS_TITLES, {
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_COLOR_REQUIRED
            : 'Неверное значение для цвета',
      }),
      tone: z.enum(['light', 'medium', 'dark'], {
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_COLOR_REQUIRED
            : 'Неверное значение для цвета',
      }),
    })
    .nullable()
    .optional(),
})

export type TaskEditDTO = z.infer<typeof TaskEditDTOSchema>
