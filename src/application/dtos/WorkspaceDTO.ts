import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

export const WorkspaceDTOSchema = z.object({
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_NAME_REQUIRED
          : ErrorMessages.WORKSPACE_NAME_INVALID,
    })
    .min(1, ErrorMessages.WORKSPACE_NAME_LESS_THAN_1)
    .max(100, ErrorMessages.WORKSPACE_NAME_MORE_THAN_100),
  color: z.enum(BASE_COLORS, {
    error: (iss) =>
      iss.input === undefined
        ? ErrorMessages.WORKSPACE_COLOR_REQUIRED
        : 'Неверное значение для цвета. Допустимы: ' + BASE_COLORS.join(', '),
  }),
  order: z
    .union([z.string(), z.number()], {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_ORDER_TYPE_INVALID
          : ErrorMessages.WORKSPACE_ORDER_TYPE_INVALID,
    })
    .optional(),
  isFavorite: z.boolean(ErrorMessages.BOARD_IS_FAVORITE_TYPE_INVALID).optional(),
  threadId: z.string(ErrorMessages.THREAD_ID_INVALID).nullable().optional(),
})

export type WorkspaceDTO = z.infer<typeof WorkspaceDTOSchema>
