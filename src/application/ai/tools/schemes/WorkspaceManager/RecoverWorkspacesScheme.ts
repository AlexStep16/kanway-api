import z from 'zod'

export const RecoverWorkspacesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  workspace_ids: z.array(z.string()).optional().describe('Target workspace ids.'),
}).describe(`
  Recover workspaces.
  Pass selection_id or workspace_ids.
`)

export type RecoverWorkspacesDTO = z.infer<typeof RecoverWorkspacesScheme>
