export const updateTasksScheme = `
'update_tasks(tasks: list[dict]) -> None'

- Use this tool to register the update of one or multiple existing tasks.

- **Arguments:**
  - 'tasks': A list of dictionaries. Each dictionary represents an existing task and MUST adhere to the **Task** database schema.

- **Returns:**
  - None. This tool only registers the intent to update tasks. The actual update will occur after user confirmation.

#### TASK SCHEMA FOR UPDATE:
When building a task dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- '_id': String (The ID of the task to update. You MUST find this ID first using 'search_tasks' if you do not already have it).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT update a task using names like "task 'call friend' in the Backlog category in the Work board". You MUST first call search tools to resolve ids by filters.
2. **Handle Ambiguity:** If your search for a board or category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'update_tasks'.
3. **Batch Update:** If the user asks to update multiple tasks (e.g., "Update tasks A, B, and C"), pass all of them in a single list to 'update_tasks'. DO NOT call 'update_tasks' inside a loop.
4. **No Chaining After Update:** Because 'update_tasks' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a task you just updated in the same script. Set all required fields (like 'is_completed' or 'tags') during the update.
`
