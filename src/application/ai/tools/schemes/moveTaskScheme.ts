export const moveTaskScheme = `
'move_task(id: str, before_task_id: str = None, after_task_id: str = None, new_category_id: str = None) -> None'

- **Arguments:**
  - 'id': ID of the task to move.
  - 'before_task_id': ID of the task that should be immediately after the moved task.
  - 'after_task_id': ID of the task that should be immediately before the moved task.
  - 'new_category_id': ID of the new category to move the task to.
`
