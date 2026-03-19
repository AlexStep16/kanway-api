export const createTasksScheme = `
'create_tasks(tasks: list[dict]) -> list[string]'

- Use this tool to register the creation of one or multiple new tasks.

- **Arguments:**
  - 'tasks': A list of dictionaries. Each dictionary represents a new task and MUST adhere to the **Task** database schema.

- **Returns:** A list of string IDs corresponding to the created tasks.

#### ⚠️ CRITICAL RULE: VIRTUAL IDs & CHAINING
The IDs returned by 'create_tasks' are **VIRTUAL/TEMPORARY**. Task creation is deferred, meaning the tasks are NOT actually saved to the database until the entire script finishes executing.

- ✅ **ALLOWED (Chaining):** You MAY pass these returned virtual IDs directly into other tools within the same script (e.g., 'move_task', 'update_tasks', 'delete_task'). The system will automatically resolve them later.
- ❌ **FORBIDDEN (Searching):** You MUST NOT use 'search_tasks' to look for tasks you just created. Because they are not in the database yet, any search will return 0 results and break your logic.

**Example of CORRECT usage:**
\`\`\`python
new_ids = create_tasks([{"name": "Buy Milk", ...}])
# Passing the virtual ID directly to another tool is ALLOWED:
move_task(id=new_ids[0], ...)
\`\`\`

**Example of WRONG usage (DO NOT DO THIS):**
\`\`\`python
create_tasks([{"name": "Buy Milk", ...}])
# Searching for the task you just created is FORBIDDEN (it will fail):
tasks = search_tasks(search_query="Buy Milk") 
\`\`\`

---

#### TASK SCHEMA FOR CREATION:
When building a task dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the task).
- 'category': String (The ID of the category it belongs to. You MUST find this ID first using 'search_categories' or search).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT create a task using names like "in the Work board". You MUST first call 'search_boards()' and/or 'search_categories()' to resolve the exact 'board_id' and 'category_id'.
2. **Handle Ambiguity:** If your search for a board or category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'create_tasks'.
3. **Batch Creation:** If the user asks to create multiple tasks (e.g., "Create tasks A, B, and C"), pass all of them in a single list to 'create_tasks'. DO NOT call 'create_tasks' inside a loop.
`
