export const moveBoardScheme = `
'move_board(id: str, before_board_id: str = None, after_board_id: str = None, new_workspace_id: str = None) -> None'

- **Arguments:**
  - 'id': ID of the board to move.
  - 'before_board_id': ID of the board that should be immediately after the moved board. 
  - 'after_board_id': ID of the board that should be immediately before the moved board.
  - 'new_workspace_id': ID of the new workspace to move the board to. Optional if moving within the same workspace.
`
