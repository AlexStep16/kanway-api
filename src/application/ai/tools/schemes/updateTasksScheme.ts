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
`
