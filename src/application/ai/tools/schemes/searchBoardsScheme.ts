export const searchBoardsScheme = `
'search_boards(search_query: str = None, mongo_filter: dict = None) -> dict'

### SCHEMA MAPPING TIPS:
- If user says "By name/Title" -> use 'search_query' argument.
- If user says "Favorite" -> use '{{"is_favorite": True}}'.
- If user says "Archived" -> use '{{"is_deleted": True}}'.

- **Arguments:**
  - 'mongo_filter': Use fields and types defined in the **Board Entity** above. Base filters included by default (you don't need to add them, but you can override them if needed):
    - 'is_deleted': {{'$ne': True}
    - 'is_deleted_external': {{'$ne': True}}

  - 'search_query': Use this for FUZZY search by board name.
    - Useful when the user makes typos or remembers only part of the name.
    - *Example:* "Marketing", "Development".
    - **NOTE:** This runs AFTER the 'mongo_filter' is applied.

- **Returns:**:
{{
  "boards": Array<Boards>,
  "count": number,
  "hasMore": boolean
}}
`
