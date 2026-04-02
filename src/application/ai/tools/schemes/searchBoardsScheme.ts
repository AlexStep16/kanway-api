export const searchBoardsScheme = `
'search_boards(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict'

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

  - 'search_mode': Required if 'search_query' is provided. Can be either 'fuzzy' or 'semantic'.
    - 'fuzzy': Use this when the user provides a specific Board Name, or explicit keyword they expect to be present in the text.
    - 'semantic': Use this when the user describes a Topic, Concept, Intent, or Broad Category without knowing the exact titles.

  - 'limit': Max number of boards to return (default 50).

- **Returns:**
{{
  "boards": Array<Boards>,
  "count": number,
  "hasMore": boolean
}}
`
