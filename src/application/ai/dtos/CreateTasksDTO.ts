import { TASK_COLORS_TITLES } from '@/constants/TASK_COLORS.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const CreateTaskDTOSchema = z
  .object({
    _id: z.string(),
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
    due_date: z.iso.date(ErrorMessages.TASK_DUE_DATE_INVALID).optional(),
    due_hours: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(23).optional(),
    due_minutes: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(59).optional(),
    priority: z
      .enum(['low', 'medium', 'high'], {
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_PRIORITY_REQUIRED
            : ErrorMessages.TASK_PRIORITY_INVALID,
      })
      .optional(),
    category: z.string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.CATEGORY_ID_REQUIRED
          : ErrorMessages.CATEGORY_ID_INVALID,
    }),
    board: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.BOARD_ID_REQUIRED
            : ErrorMessages.BOARD_ID_INVALID,
      })
      .optional(),
    workspace: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .optional(),
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
    is_completed: z.boolean(ErrorMessages.TASK_IS_COMPLETED_INVALID).optional(),
  })
  .strict()

export const CreateTasksDTOSchema = z.object({
  tasks: CreateTaskDTOSchema.array(),
})

export type CreateTasksDTO = z.infer<typeof CreateTasksDTOSchema>
