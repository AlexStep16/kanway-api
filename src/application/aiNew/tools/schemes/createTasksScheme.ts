export const createTasksScheme = `
'create_tasks(tasks: list[dict]) -> None'

- Use this tool to register the creation of one or multiple new tasks.

- **Arguments:**
  - 'tasks': A list of dictionaries. Each dictionary represents a new task and MUST adhere to the **Task** database schema.

- **Returns:**
  - None. This tool only registers the intent to create tasks. The actual creation will occur after user confirmation.

#### TASK SCHEMA FOR CREATION:
When building a task dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the task).
- 'category': String (The ID of the category it belongs to. You MUST find this ID first using 'search_categories' or search).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT create a task using names like "in the Work board". You MUST first call 'search_boards()' and/or 'search_categories()' to resolve the exact 'board_id' and 'category_id'.
2. **Handle Ambiguity:** If your search for a board or category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'create_tasks'.
3. **Batch Creation:** If the user asks to create multiple tasks (e.g., "Create tasks A, B, and C"), pass all of them in a single list to 'create_tasks'. DO NOT call 'create_tasks' inside a loop.
4. **No Chaining After Creation:** Because 'create_tasks' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a task you just created in the same script. Set all required fields (like 'is_completed' or 'tags') during creation.
`
