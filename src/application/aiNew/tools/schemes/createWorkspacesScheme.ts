export const createWorkspacesScheme = `
'create_workspaces(workspaces: list[dict]) -> None'

- Use this tool to register the creation of one or multiple new workspaces.

- **Arguments:**
  - 'workspaces': A list of dictionaries. Each dictionary represents a new workspace and MUST adhere to the **Workspace** database schema.

- **Returns:**
  - None. This tool only registers the intent to create workspaces. The actual creation will occur after user confirmation.

#### WORKSPACE SCHEMA FOR CREATION:
When building a workspace dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the workspace).

#### USAGE STRATEGY & RULES:
1. **Batch Creation:** If the user asks to create multiple workspaces (e.g., "Create workspaces A, B, and C"), pass all of them in a single list to 'create_workspaces'. DO NOT call 'create_workspaces' inside a loop.
2. **No Chaining After Creation:** Because 'create_workspaces' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a workspace you just created in the same script. Set all required fields (like 'order', 'is_favorite') during creation.
`
