import { TASK_COLORS } from '@/constants/TASK_COLORS.ts'
import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const TaskDTOSchema = z.object({
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
    .optional(),
  dueDate: z.iso.datetime(ErrorsMessage.TASK_DUE_DATE_INVALID).optional(),
  categoryId: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.CATEGORY_ID_REQUIRED
        : ErrorsMessage.CATEGORY_ID_INVALID,
  }),
  color: z.enum(TASK_COLORS, {
    error: (iss) =>
      iss.input === undefined ? ErrorsMessage.TASK_COLOR_REQUIRED : 'Неверное значение для цвета.',
  }),
  tags: z.array(z.union([z.string(), z.number()]), ErrorsMessage.TASK_TAGS_INVALID_TYPE).optional(),
  isCompleted: z.boolean(ErrorsMessage.TASK_IS_COMPLETED_INVALID).optional(),
  order: z
    .union([z.string(), z.number()], {
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.TASK_ORDER_TYPE_INVALID
          : ErrorsMessage.TASK_ORDER_TYPE_INVALID,
    })
    .optional(),

  timezone: z.string().optional(),
})

export type TaskDTO = z.infer<typeof TaskDTOSchema>
