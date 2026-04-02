export const archiveTasksScheme = `
'archive_tasks(ids: list[string]) -> None'

- Use this tool to register the archiving of one or multiple new tasks.

- **Arguments:**
  - 'ids': A list of string IDs representing the tasks to be archived.
---

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT archive a task using names like "Archive the task in the Work board". You MUST first call 'search_tasks()' to resolve the exact 'task_id'.
2. **Handle Ambiguity:** If your search for a task returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_tasks'.
3. **Batch Archiving:** If the user asks to archive multiple tasks (e.g., "Archive tasks A, B, and C"), pass all of their IDs in a single list to 'archive_tasks'. DO NOT call 'archive_tasks' inside a loop.
`
