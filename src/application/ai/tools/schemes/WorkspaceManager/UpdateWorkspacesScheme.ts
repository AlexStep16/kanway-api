import z from 'zod'
import { StringUpdateSchema } from '../updateSchemes.js'
import { BASE_COLORS_MAP } from '@/constants/BASE_COLORS.js'

export const UpdateWorkspacesScheme = z.object({
  selection_id: z.string().optional().describe('Apply updates to this selection of workspaces.'),
  workspace_ids: z
    .array(z.string())
    .optional()
    .describe('Apply updates to these specific workspaces only.'),

  updates: z.object({
    name: StringUpdateSchema.optional(),
    color: z.enum(Object.values(BASE_COLORS_MAP).map((color) => color.name)).optional(),
    is_favorite: z.boolean().optional(),
  }),
}).describe(`
  Tool to update workspaces. You can specify a selection_id or multiple workspace_ids.
  For fields like 'name', you can either overwrite them with a flat value,
  or perform operations like appending text or prepending text.
`)

export type UpdateWorkspacesDTO = z.infer<typeof UpdateWorkspacesScheme>
