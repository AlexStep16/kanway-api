import { TASK_COLORS } from '@/constants/TASK_COLORS.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const TaskDTOSchema = z.object({
  id: z.string(ErrorsMessage.TASK_ID_INVALID).optional(),
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.TASK_NAME_REQUIRED
          : ErrorsMessage.TASK_NAME_INVALID,
    })
    .min(1, ErrorsMessage.TASK_NAME_LESS_THAN_1)
    .max(100, ErrorsMessage.TASK_NAME_MORE_THAN_100),
  description: z
    .string(ErrorsMessage.TASK_DESCRIPTION_INVALID)
    .min(1, ErrorsMessage.TASK_DESCRIPTION_LESS_THAN_1)
    .max(300, ErrorsMessage.TASK_DESCRIPTION_MORE_THAN_300)
    .nullable()
    .optional(),
  dueDate: z.iso.date(ErrorsMessage.TASK_DUE_DATE_INVALID).nullable().optional(),
  dueHours: z.number(ErrorsMessage.TASK_DUE_TIME_INVALID).min(0).max(23).nullable().optional(),
  dueMinutes: z.number(ErrorsMessage.TASK_DUE_TIME_INVALID).min(0).max(59).nullable().optional(),
  categoryId: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.CATEGORY_ID_REQUIRED
          : ErrorsMessage.CATEGORY_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorsMessage.CATEGORY_ID_INVALID),
  categoryName: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.CATEGORY_NAME_REQUIRED
        : ErrorsMessage.CATEGORY_NAME_INVALID,
  }),
  boardId: z
    .string({
      error: (iss) =>
        iss.input === undefined ? ErrorsMessage.BOARD_ID_REQUIRED : ErrorsMessage.BOARD_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorsMessage.BOARD_ID_INVALID),
  boardName: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.BOARD_NAME_REQUIRED
        : ErrorsMessage.BOARD_NAME_INVALID,
  }),
  workspaceId: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.WORKSPACE_ID_REQUIRED
          : ErrorsMessage.WORKSPACE_ID_INVALID,
    })
    .regex(objectIdRegex, ErrorsMessage.WORKSPACE_ID_INVALID),
  workspaceName: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.WORKSPACE_NAME_REQUIRED
        : ErrorsMessage.WORKSPACE_NAME_INVALID,
  }),
  color: z
    .enum(TASK_COLORS, {
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.TASK_COLOR_REQUIRED
          : 'Неверное значение для цвета.',
    })
    .nullable()
    .optional(),
  tags: z
    .array(z.union([z.string(), z.number()]), ErrorsMessage.TASK_TAGS_INVALID_TYPE)
    .nullable()
    .optional(),
  isCompleted: z.boolean(ErrorsMessage.TASK_IS_COMPLETED_INVALID).nullable().optional(),
  order: z
    .union([z.string(), z.number()], {
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.TASK_ORDER_TYPE_INVALID
          : ErrorsMessage.TASK_ORDER_TYPE_INVALID,
    })
    .nullable()
    .optional(),
    threadId: z.string(ErrorsMessage.THREAD_ID_INVALID).nullable().optional(),
})

export type TaskDTO = z.infer<typeof TaskDTOSchema>
