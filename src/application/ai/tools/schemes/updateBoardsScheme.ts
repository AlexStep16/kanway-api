export const updateBoardsScheme = `
'update_boards(boards: list[dict]) -> None'

- Use this tool to register the update of one or multiple existing boards.

- **Arguments:**
  - 'boards': A list of dictionaries. Each dictionary represents an existing board and MUST adhere to the **Board** database schema.

- **Returns:**
  - None. This tool only registers the intent to update boards. The actual update will occur after user confirmation.

#### BOARD SCHEMA FOR UPDATE:
When building a board dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- '_id': String (The ID of the board to update. You MUST find this ID first using 'search_boards' if you do not already have it).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT update a board using names like "Project Alpha in the Personal workspace". You MUST first call search tools to resolve ids by filters.
2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'update_boards'.
3. **Batch Update:** If the user asks to update multiple boards (e.g., "Update boards A, B, and C"), pass all of them in a single list to 'update_boards'. DO NOT call 'update_boards' inside a loop.
4. **No Chaining After Update:** Because 'update_boards' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a board you just updated in the same script. Set all required fields (like 'is_favorite') during the update.
`
