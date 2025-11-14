import { ErrorsMessage } from '@/enums/ErrorsMessage.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryDTOSchema = z.object({
  id: z.string(ErrorsMessage.TASK_ID_INVALID).optional(),
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorsMessage.CATEGORY_NAME_REQUIRED
          : ErrorsMessage.CATEGORY_NAME_INVALID,
    })
    .min(1, ErrorsMessage.CATEGORY_NAME_LESS_THAN_1)
    .max(100, ErrorsMessage.CATEGORY_NAME_MORE_THAN_100),
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
  order: z.union([z.string(), z.number()], ErrorsMessage.CATEGORY_ORDER_TYPE_INVALID).optional(),
})

export type CategoryDTO = z.infer<typeof CategoryDTOSchema>
