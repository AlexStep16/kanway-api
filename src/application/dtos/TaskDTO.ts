import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskDTOSchema = z
  .object({
    id: z.string(ErrorMessages.TASK_ID_INVALID).optional(),
    name: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_NAME_REQUIRED
            : ErrorMessages.TASK_NAME_INVALID,
      })
      .min(1, ErrorMessages.TASK_NAME_LESS_THAN_1)
      .max(100, ErrorMessages.TASK_NAME_MORE_THAN_100),
    description: z
      .string(ErrorMessages.TASK_DESCRIPTION_INVALID)
      .max(1000, ErrorMessages.TASK_DESCRIPTION_MORE_THAN_1000)
      .optional(),
    dueDate: z.iso.date(ErrorMessages.TASK_DUE_DATE_INVALID).optional(),
    dueHours: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(23).optional(),
    dueMinutes: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(59).optional(),
    priority: z
      .enum(['low', 'medium', 'high'], {
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_PRIORITY_REQUIRED
            : ErrorMessages.TASK_PRIORITY_INVALID,
      })
      .optional(),
    columnId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.COLUMN_ID_REQUIRED
            : ErrorMessages.COLUMN_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.COLUMN_ID_INVALID),
    color: z
      .object({
        value: z.enum(TASK_COLORS_TITLES, {
          error: (iss) =>
            iss.input === undefined
              ? ErrorMessages.TASK_COLOR_REQUIRED
              : 'Неверное значение для цвета.',
        }),
        tone: z.enum(['light', 'medium', 'dark'], {
          error: (iss) =>
            iss.input === undefined
              ? ErrorMessages.TASK_COLOR_REQUIRED
              : 'Неверное значение для цвета.',
        }),
      })
      .optional(),
    tags: z.array(z.string(), ErrorMessages.TASK_TAGS_INVALID_TYPE).optional(),
    isCompleted: z.boolean(ErrorMessages.TASK_IS_COMPLETED_INVALID).optional(),
  })
  .strict()

export type TaskDTO = z.infer<typeof TaskDTOSchema>
