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
`
