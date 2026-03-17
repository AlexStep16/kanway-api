export const createBoardsScheme = `
'create_boards(boards: list[dict]) -> None'

- Use this tool to register the creation of one or multiple new boards.

- **Arguments:**
  - 'boards': A list of dictionaries. Each dictionary represents a new board and MUST adhere to the **Board** database schema.

- **Returns:**
  - None. This tool only registers the intent to create boards. The actual creation will occur after user confirmation.

#### BOARD SCHEMA FOR CREATION:
When building a board dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the board).
- 'workspace': String (The ID of the workspace it belongs to. You MUST find this ID first using 'search_workspaces' or search).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT create a board using names like "in the Work workspace". You MUST first call 'search_workspaces()' to resolve the exact 'workspace_id'.
2. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'create_boards'.
3. **Batch Creation:** If the user asks to create multiple boards (e.g., "Create boards A, B, and C"), pass all of them in a single list to 'create_boards'. DO NOT call 'create_boards' inside a loop.
4. **No Chaining After Creation:** Because 'create_boards' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a board you just created in the same script. Set all required fields (like 'order', 'is_favorite') during creation.
`
