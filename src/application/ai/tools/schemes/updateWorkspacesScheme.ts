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
`
