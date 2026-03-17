export const displayToUserScheme = `
'display_to_user(view_type: str, ids: list[str], title: str = None)

- Use this tool instead of 'print()' whenever the user asks to see tasks, boards, columns or workspaces.
- Pass ONLY the list of entity IDs (e.g. task IDs), not the full objects.

#### SUPPORTED VIEW TYPES:

1. 'task'
  - Use for: Lists of tasks found via search.
  - *Example:* display_to_user('task', ids=['id1', 'id2'], title='Found 2 Tasks')

2. 'board'
  - Use for: List of boards.
  - *Example:* display_to_user('board', ids=['id1', 'id2'], title='Found 2 Boards')
3. 'column'
  - Use for: List of columns.
  - *Example:* display_to_user('column', ids=['id1', 'id2'], title='Found 2 Columns')
4. 'workspace'
  - Use for: List of workspaces.
  - *Example:* display_to_user('workspace', ids=['id1', 'id2'], title='Found 2 Workspaces')
`
