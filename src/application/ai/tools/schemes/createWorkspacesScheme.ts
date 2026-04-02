export const createWorkspacesScheme = `
'create_workspaces(workspaces: list[dict]) -> list[string]'

- Use this tool to register the creation of one or multiple new workspaces.

- **Arguments:**
  - 'workspaces': A list of dictionaries. Each dictionary represents a new workspace and MUST adhere to the **Workspace** database schema.

- **Returns:** A list of string IDs corresponding to the created workspaces.

#### ⚠️ CRITICAL RULE: VIRTUAL IDs & CHAINING
The IDs returned by 'create_workspaces' are **VIRTUAL/TEMPORARY**. workspace creation is deferred, meaning the workspaces are NOT actually saved to the database until the entire script finishes executing.

- ✅ **ALLOWED (Chaining):** You MAY pass these returned virtual IDs directly into other tools within the same script (e.g., 'move_workspace', 'update_workspaces', 'delete_workspace'). The system will automatically resolve them later.
- ❌ **FORBIDDEN (Searching):** You MUST NOT use 'search_workspaces' to look for workspaces you just created. Because they are not in the database yet, any search will return 0 results and break your logic.

**Example of CORRECT usage:**
\`\`\`python
new_ids = create_workspaces([{"name": "Alpha", ...}])
# Passing the virtual ID directly to another tool is ALLOWED:
move_workspace(id=new_ids[0], ...)
\`\`\`

**Example of WRONG usage (DO NOT DO THIS):**
\`\`\`python
create_workspaces([{"name": "Alpha", ...}])
# Searching for the workspace you just created is FORBIDDEN (it will fail):
workspaces = search_workspaces(search_query="Alpha")
\`\`\`

---

#### WORKSPACE SCHEMA FOR CREATION:
When building a workspace dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the workspace).
`
