export const archiveBoardsScheme = `
'archive_boards(ids: list[string]) -> None'

- Use this tool to register the archiving of one or multiple new boards.

- **Arguments:**
  - 'ids': A list of string IDs representing the boards to be archived.
---

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT archive a board using names like "Archive the board in the Work workspace". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_boards'.
3. **Batch Archiving:** If the user asks to archive multiple boards (e.g., "Archive boards A, B, and C"), pass all of their IDs in a single list to 'archive_boards'. DO NOT call 'archive_boards' inside a loop.
`
