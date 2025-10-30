import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'
import { BASE_COLORS } from '@constants/BASE_COLORS.ts'

export const WorkspaceDTOSchema = z.object({
  name: z
    .string({
      required_error: ErrorsMessage.WORKSPACE_NAME_REQUIRED,
      invalid_type_error: ErrorsMessage.WORKSPACE_NAME_INVALID,
    })
    .min(1, ErrorsMessage.WORKSPACE_NAME_REQUIRED),
  color: z.enum(BASE_COLORS, {
    required_error: ErrorsMessage.WORKSPACE_COLOR_REQUIRED,
    invalid_type_error: 'Неверное значение для цвета. Допустимы: ' + BASE_COLORS.join(', '),
  }),
  order: z
    .union([z.string(), z.number()], {
      invalid_type_error: ErrorsMessage.WORKSPACE_ORDER_TYPE_INVALID,
    })
    .optional(),
})

export type WorkspaceDTO = z.infer<typeof WorkspaceDTOSchema>
