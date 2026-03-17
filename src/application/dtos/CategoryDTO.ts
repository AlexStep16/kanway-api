import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CategoryDTOSchema = z
  .object({
    id: z.string(ErrorMessages.CATEGORY_ID_INVALID).optional(),
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
          iss.input === undefined
            ? ErrorMessages.BOARD_ID_REQUIRED
            : ErrorMessages.BOARD_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.BOARD_ID_INVALID),
    workspaceId: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
    order: z.number(ErrorMessages.CATEGORY_ORDER_TYPE_INVALID).optional(),
  })
  .strict()

export type CategoryDTO = z.infer<typeof CategoryDTOSchema>
