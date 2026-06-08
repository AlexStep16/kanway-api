import { BASE_COLORS_MAP } from '@/constants/BASE_COLORS.js'
import z from 'zod'

export const CreateWorkspacesScheme = z.object({
  workspaces: z.array(
    z.object({
      name: z.string().describe('The new name of the workspace.'),
      is_favorite: z.boolean().optional().describe('Whether the workspace is a favorite.'),
      color: z
        .enum(Object.values(BASE_COLORS_MAP).map((color) => color.name))
        .optional()
        .describe('The color of the workspace.'),
    }),
  ),
}).describe(`
  Tool to create workspaces. You can specify multiple workspaces to be created at once.
  Required fields are 'name'.
`)

export type CreateWorkspacesDTO = z.infer<typeof CreateWorkspacesScheme>
