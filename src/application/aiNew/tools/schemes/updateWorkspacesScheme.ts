export const updateWorkspacesScheme = `
'update_workspaces(workspaces: list[dict]) -> None'

- Use this tool to register the update of one or multiple existing workspaces.

- **Arguments:**
  - 'workspaces': A list of dictionaries. Each dictionary represents an existing workspace and MUST adhere to the **Workspace** database schema.

- **Returns:**
  - None. This tool only registers the intent to update workspaces. The actual update will occur after user confirmation.

#### WORKSPACE SCHEMA FOR UPDATE:
When building a workspace dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- '_id': String (The ID of the workspace to update. You MUST find this ID first using 'search_workspaces' if you do not already have it).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT update a workspace using names like "Personal workspace". You MUST first call search tools to resolve ids by filters.
2. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'update_workspaces'.
3. **Batch Update:** If the user asks to update multiple workspaces (e.g., "Update workspaces A, B, and C"), pass all of them in a single list to 'update_workspaces'. DO NOT call 'update_workspaces' inside a loop.
4. **No Chaining After Update:** Because 'update_workspaces' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a workspace you just updated in the same script. Set all required fields (like 'order', 'is_favorite') during the update.
`
