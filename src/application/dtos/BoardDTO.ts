import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const BoardDTOSchema = z.object({
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.BOARD_NAME_REQUIRED
          : ErrorMessages.BOARD_NAME_INVALID,
    })
    .min(1, ErrorMessages.BOARD_NAME_LESS_THAN_1)
    .max(100, ErrorMessages.BOARD_NAME_MORE_THAN_100),
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
  order: z.union([z.string(), z.number()], ErrorMessages.BOARD_ORDER_TYPE_INVALID).optional(),
  isFavorite: z.boolean(ErrorMessages.BOARD_IS_FAVORITE_TYPE_INVALID).optional(),
  threadId: z.string(ErrorMessages.THREAD_ID_INVALID).nullable().optional(),
})

export type BoardDTO = z.infer<typeof BoardDTOSchema>
