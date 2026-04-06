export const PythonSdk = `
**ARCHIVE:**
  - archive_boards(ids: list[string]) -> None
  - archive_categories(ids: list[string]) -> None
  - archive_tasks(ids: list[string]) -> None
  - archive_workspaces(ids: list[string]) -> None

**CLONE:**
  - clone_boards(ids: list[string]) -> list[string]
  - clone_categories(ids: list[string]) -> list[string]
  - clone_tasks(ids: list[string]) -> list[string]
  - clone_workspaces(ids: list[string]) -> list[string]

**CREATE:**
  - create_boards(boards: list[dict]) -> list[string]
  - create_categories(categories: list[dict]) -> list[string]
  - create_tasks(tasks: list[dict]) -> list[string]
  - create_workspaces(workspaces: list[dict]) -> list[string]

**DELETE:**
  - delete_boards(ids: list[string]) -> None
  - delete_categories(ids: list[string]) -> None
  - delete_tasks(ids: list[string]) -> None
  - delete_workspaces(ids: list[string]) -> None

**MOVE:**
  - move_board(id: str, before_id: str = None, after_id: str = None, new_workspace_id: str = None) -> None
  - move_category(id: str, before_id: str = None, after_category_id: str = None, new_board_id: str = None) -> None
  - move_task(id: str, before_id: str = None, after_id: str = None, new_category_id: str = None) -> None
  - move_workspace(id: str, before_id: str = None, after_id: str = None) -> None

**RECOVER:**
  - recover_boards(ids: list[string]) -> None
  - recover_categories(ids: list[string]) -> None
  - recover_tasks(ids: list[string]) -> None
  - recover_workspaces(ids: list[string]) -> None

**SEARCH:**
  - search_boards(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict
  - search_categories(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict
  - search_tasks(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict
  - search_workspaces(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict

**UPDATE:**
  - update_boards(boards: list[dict]) -> None
  - update_categories(categories: list[dict]) -> None
  - update_tasks(tasks: list[dict]) -> None
  - update_workspaces(workspaces: list[dict]) -> None

**GENERAL:**
  - undo_operation(log_id: str) -> None
  - resolve_ambiguous(entity_type: str, ids: list[str], min_select=1, max_select=1, id: str) -> list[str]
  - display_to_user(view_type: 'task' | 'category' | 'board' | 'workspace', ids: list[str], title: str = None) -> None
`
