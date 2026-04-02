export const archiveWorkspacesScheme = `
'archive_workspaces(ids: list[string]) -> None'

- Use this tool to register the archiving of one or multiple new workspaces.

- **Arguments:**
  - 'ids': A list of string IDs representing the workspaces to be archived.
---

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT archive a workspace using names like "Archive the workspace in the Work workspace". You MUST first call 'search_workspaces()' to resolve the exact 'workspace_id'.
2. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_workspaces'.
3. **Batch Archiving:** If the user asks to archive multiple workspaces (e.g., "Archive workspaces A, B, and C"), pass all of their IDs in a single list to 'archive_workspaces'. DO NOT call 'archive_workspaces' inside a loop.
`
