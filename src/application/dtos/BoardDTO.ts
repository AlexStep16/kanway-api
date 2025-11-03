import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

export const BoardDTOSchema = z.object({
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.BOARD_NAME_REQUIRED
          : ErrorsMessage.BOARD_NAME_INVALID,
    })
    .min(1, ErrorsMessage.BOARD_NAME_LESS_THAN_1)
    .max(100, ErrorsMessage.BOARD_NAME_MORE_THAN_100),
  workspaceId: z.string({
    error: (iss) =>
      iss.input === undefined
        ? ErrorsMessage.WORKSPACE_ID_REQUIRED
        : ErrorsMessage.WORKSPACE_ID_INVALID,
  }),
  order: z.union([z.string(), z.number()], ErrorsMessage.BOARD_ORDER_TYPE_INVALID).optional(),
})

export type BoardDTO = z.infer<typeof BoardDTOSchema>
