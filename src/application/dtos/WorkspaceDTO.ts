import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

export const WorkspaceDTOSchema = z.object({
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.WORKSPACE_NAME_REQUIRED
          : ErrorsMessage.WORKSPACE_NAME_INVALID,
    })
    .min(1, ErrorsMessage.WORKSPACE_NAME_LESS_THAN_1)
    .max(100, ErrorsMessage.WORKSPACE_NAME_MORE_THAN_100),
  color: z.enum(BASE_COLORS, {
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.WORKSPACE_COLOR_REQUIRED
        : 'Неверное значение для цвета. Допустимы: ' + BASE_COLORS.join(', '),
  }),
  order: z
    .union([z.string(), z.number()], {
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.WORKSPACE_ORDER_TYPE_INVALID
          : ErrorsMessage.WORKSPACE_ORDER_TYPE_INVALID,
    })
    .optional(),
})

export type WorkspaceDTO = z.infer<typeof WorkspaceDTOSchema>
