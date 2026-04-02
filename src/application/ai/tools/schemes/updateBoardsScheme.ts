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
`
