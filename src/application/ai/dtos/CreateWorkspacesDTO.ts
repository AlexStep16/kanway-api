import { BASE_COLORS } from '@/constants/BASE_COLORS.js'
import { ErrorMessages } from '@/enums/ErrorMessages.js'
import { z } from 'zod'

export const CreateWorkspaceDTOSchema = z
  .object({
    _id: z.string(),
    name: z
      .string({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_NAME_REQUIRED
            : ErrorMessages.WORKSPACE_NAME_INVALID,
      })
      .min(1, ErrorMessages.WORKSPACE_NAME_LESS_THAN_1)
      .max(100, ErrorMessages.WORKSPACE_NAME_MORE_THAN_100),
    is_favorite: z
      .boolean({
        error: (iss) =>
          iss.input === undefined
            ? ErrorMessages.WORKSPACE_IS_FAVORITE_TYPE_INVALID
            : ErrorMessages.WORKSPACE_IS_FAVORITE_TYPE_INVALID,
      })
      .optional(),
    color: z.enum(BASE_COLORS, {
      error: (iss) =>
        iss.input === undefined
          ? ErrorMessages.WORKSPACE_COLOR_REQUIRED
          : 'Неверное значение для цвета. Допустимы: ' + BASE_COLORS.join(', '),
    }),
  })
  .strict()

export const CreateWorkspacesDTOSchema = z.object({
  workspaces: CreateWorkspaceDTOSchema.array(),
})

export type CreateWorkspacesDTO = z.infer<typeof CreateWorkspacesDTOSchema>
