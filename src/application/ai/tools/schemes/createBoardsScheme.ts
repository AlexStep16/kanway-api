export const createBoardsScheme = `
'create_boards(boards: list[dict]) -> list[string]'

- Use this tool to register the creation of one or multiple new boards.

- **Arguments:**
  - 'boards': A list of dictionaries. Each dictionary represents a new board and MUST adhere to the **Board** database schema.

- **Returns:** A list of string IDs corresponding to the created boards.

#### ⚠️ CRITICAL RULE: VIRTUAL IDs & CHAINING
The IDs returned by 'create_boards' are **VIRTUAL/TEMPORARY**. board creation is deferred, meaning the boards are NOT actually saved to the database until the entire script finishes executing.

- ✅ **ALLOWED (Chaining):** You MAY pass these returned virtual IDs directly into other tools within the same script (e.g., 'move_board', 'update_boards', 'delete_board'). The system will automatically resolve them later.
- ❌ **FORBIDDEN (Searching):** You MUST NOT use 'search_boards' to look for boards you just created. Because they are not in the database yet, any search will return 0 results and break your logic.

**Example of CORRECT usage:**
\`\`\`python
new_ids = create_boards([{"name": "Personal", ...}])
# Passing the virtual ID directly to another tool is ALLOWED:
move_board(id=new_ids[0], ...)
\`\`\`

**Example of WRONG usage (DO NOT DO THIS):**
\`\`\`python
create_boards([{"name": "Personal", ...}])
# Searching for the board you just created is FORBIDDEN (it will fail):
boards = search_boards(search_query="Personal")
\`\`\`

---

#### BOARD SCHEMA FOR CREATION:
When building a board dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the board).
- 'workspace': String (The ID of the workspace it belongs to. You MUST find this ID first using 'search_workspaces' or search).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT create a board using names like "in the Work workspace". You MUST first call 'search_workspaces()' to resolve the exact 'workspace_id'.
2. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'create_boards'.
3. **Batch Creation:** If the user asks to create multiple boards (e.g., "Create boards A, B, and C"), pass all of them in a single list to 'create_boards'. DO NOT call 'create_boards' inside a loop.
`
