import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const CreateCategoryDTOSchema = z
  .object({
    _id: z.string(),
    name: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.TASK_NAME_REQUIRED
            : ErrorMessages.TASK_NAME_INVALID,
      })
      .min(1, ErrorMessages.TASK_NAME_LESS_THAN_1)
      .max(100, ErrorMessages.TASK_NAME_MORE_THAN_100),
    board: z.string({
      error: (iss) =>
        iss.input === undefined ? ErrorMessages.BOARD_ID_REQUIRED : ErrorMessages.BOARD_ID_INVALID,
    }),
    workspace: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_ID_REQUIRED
            : ErrorMessages.WORKSPACE_ID_INVALID,
      })
      .optional(),
  })
  .strict()

export const CreateCategoriesDTOSchema = z.object({
  categories: CreateCategoryDTOSchema.array(),
})

export type CreateCategoriesDTO = z.infer<typeof CreateCategoriesDTOSchema>
