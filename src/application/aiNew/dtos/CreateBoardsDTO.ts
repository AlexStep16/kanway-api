import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

const objectIdRegex = /^[0-9a-fA-F]{24}$/

export const CreateBoardDTOSchema = z
  .object({
    id: z.string(),
    name: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.BOARD_NAME_REQUIRED
            : ErrorMessages.BOARD_NAME_INVALID,
      })
      .min(1, ErrorMessages.BOARD_NAME_LESS_THAN_1)
      .max(100, ErrorMessages.BOARD_NAME_MORE_THAN_100),
    workspace: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .regex(objectIdRegex, ErrorMessages.WORKSPACE_ID_INVALID),
    order: z
      .number({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_ORDER_TYPE_INVALID
            : ErrorMessages.TASK_ORDER_TYPE_INVALID,
      })
      .optional(),
    is_favorite: z
      .boolean({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.BOARD_IS_FAVORITE_TYPE_INVALID
            : ErrorMessages.BOARD_IS_FAVORITE_TYPE_INVALID,
      })
      .optional(),
  })
  .strict()

export const CreateBoardsDTOSchema = z.object({
  boards: CreateBoardDTOSchema.array(),
})

export type CreateBoardsDTO = z.infer<typeof CreateBoardsDTOSchema>
