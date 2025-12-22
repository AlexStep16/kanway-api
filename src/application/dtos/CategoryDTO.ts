import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryDTOSchema = z.object({
  id: z.string(ErrorMessages.TASK_ID_INVALID).optional(),
  name: z
    .string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.CATEGORY_NAME_REQUIRED
          : ErrorMessages.CATEGORY_NAME_INVALID,
    })
    .min(1, ErrorMessages.CATEGORY_NAME_LESS_THAN_1)
    .max(100, ErrorMessages.CATEGORY_NAME_MORE_THAN_100),
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
  order: z.union([z.string(), z.number()], ErrorMessages.CATEGORY_ORDER_TYPE_INVALID).optional(),
  threadId: z.string(ErrorMessages.THREAD_ID_INVALID).nullable().optional(),
})

export type CategoryDTO = z.infer<typeof CategoryDTOSchema>
