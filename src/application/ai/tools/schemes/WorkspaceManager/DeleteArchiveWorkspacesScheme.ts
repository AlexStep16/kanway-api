import z from 'zod'

export const DeleteArchiveWorkspacesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  workspace_ids: z.array(z.string()).optional().describe('Target workspace ids.'),
  soft_delete: z.boolean().describe('True: move to archive. False: hard delete.'),
}).describe(`
  Delete or archive workspaces.
  Pass selection_id or workspace_ids.
  Use soft_delete for archive vs hard delete.
`)

export type DeleteArchiveWorkspacesDTO = z.infer<typeof DeleteArchiveWorkspacesScheme>
