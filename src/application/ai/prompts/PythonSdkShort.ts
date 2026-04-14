export const PythonSdkShort = `
The Executor uses the global methods. Methods are grouped by action and support '_boards', '_categories', '_tasks', '_workspaces' (e.g., 'create_tasks', 'update_boards'):
- **CRUD:** 'create_*', 'update_*', 'delete_*', 'search_*'
- **Actions:** 'archive_*', 'clone_*', 'move_*', 'recover_*'
- **General:** 
  - 'undo_operation(log_id: str)'
  - 'resolve_ambiguous(entity_type, ids, min_select, max_select, id)'
  - 'display_to_user(view_type: 'task'|'category'|'board'|'workspace', ids: list[str], title: str = None)' -> Use ONLY for "Show/See" user intents.
`
