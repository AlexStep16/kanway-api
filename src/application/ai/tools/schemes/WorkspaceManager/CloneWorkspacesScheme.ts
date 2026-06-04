import z from 'zod'

export const CloneWorkspacesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  workspace_ids: z.array(z.string()).optional().describe('Target workspace ids.'),
}).describe(`
  Clone workspaces.
  Pass selection_id or workspace_ids.
`)

export type CloneWorkspacesDTO = z.infer<typeof CloneWorkspacesScheme>
