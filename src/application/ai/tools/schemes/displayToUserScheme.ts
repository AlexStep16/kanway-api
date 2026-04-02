export const displayToUserScheme = `
'display_to_user(view_type: str, ids: list[str], title: str = None)

- Use this tool ONLY when the system asks you to display entities to the user. Not just ask you to find or search for them.
- Pass ONLY the list of entity IDs (e.g. task IDs), not the full objects.

#### SUPPORTED VIEW TYPES: 'task', 'category', 'board', 'workspace'
`
