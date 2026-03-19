export const moveCategoryScheme = `
'move_category(id: str, before_category_id: str = None, after_category_id: str = None, new_board_id: str = None) -> None'

- **Arguments:**
  - 'id': ID of the category to move.
  - 'before_category_id': ID of the category that should be immediately after the moved category.
  - 'after_category_id': ID of the category that should be immediately before the moved category.
  - 'new_board_id': ID of the new board to move the category to. Optional if moving within the same board.
`
