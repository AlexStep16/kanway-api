export const PythonSdkShort = `
**ARCHIVE:**
  - archive_boards -> None
  - archive_categories -> None
  - archive_tasks -> None
  - archive_workspaces -> None

**CLONE:**
  - clone_boards -> list[string]
  - clone_categories -> list[string]
  - clone_tasks -> list[string]
  - clone_workspaces -> list[string]

**CREATE:**
  - create_boards -> list[string]
  - create_categories -> list[string]
  - create_tasks -> list[string]
  - create_workspaces -> list[string]

**DELETE:**
  - delete_boards -> None
  - delete_categories -> None
  - delete_tasks -> None
  - delete_workspaces -> None

**MOVE:**
  - move_board -> None
  - move_category -> None
  - move_task -> None
  - move_workspace -> None

**RECOVER:**
  - recover_boards -> None
  - recover_categories -> None
  - recover_tasks -> None
  - recover_workspaces -> None

**SEARCH:**
  - search_boards -> dict
  - search_categories -> dict
  - search_tasks -> dict
  - search_workspaces -> dict

**UPDATE:**
  - update_boards -> None
  - update_categories -> None
  - update_tasks -> None
  - update_workspaces -> None

**GENERAL:**
  - undo_operation(log_id: str) -> None
  - resolve_ambiguous(entity_type: str, ids: list[str], min_select=1, max_select=1, id: str) -> list[str]
  - display_to_user(view_type: 'task' | 'category' | 'board' | 'workspace', ids: list[str], title: str = None) -> None
`
