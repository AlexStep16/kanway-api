import { TASK_COLORS } from '@/constants/TASK_COLORS.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
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
      .min(1, ErrorMessages.TASK_DESCRIPTION_LESS_THAN_1)
      .max(300, ErrorMessages.TASK_DESCRIPTION_MORE_THAN_300)
      .optional(),
    dueDate: z.iso.date(ErrorMessages.TASK_DUE_DATE_INVALID).optional(),
    dueHours: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(23).optional(),
    dueMinutes: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(59).optional(),
    categoryId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.CATEGORY_ID_REQUIRED
            : ErrorMessages.CATEGORY_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.CATEGORY_ID_INVALID),
    boardId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.BOARD_ID_REQUIRED
            : ErrorMessages.BOARD_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
    workspaceId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
    color: z
      .enum(TASK_COLORS, {
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_COLOR_REQUIRED
            : 'Неверное значение для цвета.',
      })
      .optional(),
    tags: z.array(z.string(), ErrorMessages.TASK_TAGS_INVALID_TYPE).optional(),
    isCompleted: z.boolean(ErrorMessages.TASK_IS_COMPLETED_INVALID).optional(),
    order: z
      .number({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_ORDER_TYPE_INVALID
            : ErrorMessages.TASK_ORDER_TYPE_INVALID,
      })
      .optional(),
  })
  .strict()

export type TaskDTO = z.infer<typeof TaskDTOSchema>
