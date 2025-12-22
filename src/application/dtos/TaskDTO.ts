import { TASK_COLORS } from '@/constants/TASK_COLORS.ts'
import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskDTOSchema = z.object({
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
    .nullable()
    .optional(),
  dueDate: z.iso.date(ErrorMessages.TASK_DUE_DATE_INVALID).nullable().optional(),
  dueHours: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(23).nullable().optional(),
  dueMinutes: z.number(ErrorMessages.TASK_DUE_TIME_INVALID).min(0).max(59).nullable().optional(),
  categoryId: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.CATEGORY_ID_REQUIRED
          : ErrorMessages.CATEGORY_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorMessages.CATEGORY_ID_INVALID),
  categoryName: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.CATEGORY_NAME_REQUIRED
        : ErrorMessages.CATEGORY_NAME_INVALID,
  }),
  boardId: z
    .string({
      error: (iss) =>
        iss.input === undefined ? ErrorMessages.BOARD_ID_REQUIRED : ErrorMessages.BOARD_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
  boardName: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.BOARD_NAME_REQUIRED
        : ErrorMessages.BOARD_NAME_INVALID,
  }),
  workspaceId: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_ID_REQUIRED
          : ErrorMessages.WORKSPACE_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
  workspaceName: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.WORKSPACE_NAME_REQUIRED
        : ErrorMessages.WORKSPACE_NAME_INVALID,
  }),
  color: z
    .enum(TASK_COLORS, {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.TASK_COLOR_REQUIRED
          : 'Неверное значение для цвета.',
    })
    .nullable()
    .optional(),
  tags: z
    .array(z.union([z.string(), z.number()]), ErrorMessages.TASK_TAGS_INVALID_TYPE)
    .nullable()
    .optional(),
  isCompleted: z.boolean(ErrorMessages.TASK_IS_COMPLETED_INVALID).nullable().optional(),
  order: z
    .union([z.string(), z.number()], {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.TASK_ORDER_TYPE_INVALID
          : ErrorMessages.TASK_ORDER_TYPE_INVALID,
    })
    .nullable()
    .optional(),
  threadId: z.string(ErrorMessages.THREAD_ID_INVALID).nullable().optional(),
})

export type TaskDTO = z.infer<typeof TaskDTOSchema>
