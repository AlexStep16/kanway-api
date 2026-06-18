import z from 'zod'

export const ReorderWorkspacesScheme = z.object({
  selection_id: z.string().optional().describe('Target selection id.'),
  workspace_ids: z
    .array(z.string())
    .describe(
      'The complete list of ALL workspace IDs, ordered in the exact sequence they should appear.',
    ),
}).describe(`
  Reorder all workspaces.
  Pass the complete list of workspace IDs in the desired target order.
`)

export type ReorderWorkspacesDTO = z.infer<typeof ReorderWorkspacesScheme>
