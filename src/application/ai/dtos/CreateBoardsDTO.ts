import { ErrorMessages } from '@/enums/ErrorMessages.ts'
import { z } from 'zod'

export const CreateBoardDTOSchema = z
  .object({
    _id: z.string(),
    name: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.BOARD_NAME_REQUIRED
            : ErrorMessages.BOARD_NAME_INVALID,
      })
      .min(1, ErrorMessages.BOARD_NAME_LESS_THAN_1)
      .max(100, ErrorMessages.BOARD_NAME_MORE_THAN_100),
    workspace: z.string({
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_ID_REQUIRED
          : ErrorMessages.WORKSPACE_ID_INVALID,
    }),
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
