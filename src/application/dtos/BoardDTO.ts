import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const BoardDTOSchema = z.object({
  name: z
    .string({
      required_error: ErrorsMessage.BOARD_NAME_REQUIRED,
      invalid_type_error: ErrorsMessage.BOARD_NAME_INVALID,
    })
    .min(1, ErrorsMessage.BOARD_NAME_REQUIRED),
  workspaceId: z.string({
    required_error: ErrorsMessage.WORKSPACE_ID_REQUIRED,
    invalid_type_error: ErrorsMessage.WORKSPACE_ID_INVALID,
  }),
  order: z
    .union([z.string(), z.number()], {
      invalid_type_error: ErrorsMessage.BOARD_ORDER_TYPE_INVALID,
    })
    .optional(),
})

export type BoardDTO = z.infer<typeof BoardDTOSchema>
