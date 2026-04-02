export const searchWorkspacesScheme = `
'search_workspaces(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict'

### SCHEMA MAPPING TIPS:
- If user says "By name/Title" -> use 'search_query' argument.
- If user says "Favorite" -> use '{{"is_favorite": True}}'.
- If user says "Archived" -> use '{{"is_deleted": True}}'.

- **Arguments:**
  - 'mongo_filter': Use fields and types defined in the **Workspace Entity** above. Base filters to always include:
    - 'is_deleted': {{'$ne': True}}
    - 'user_id': ObjectId of the user (must be included for all queries).

  - 'search_query': Use this for FUZZY search by workspace name.
    - Useful when the user makes typos or remembers only part of the name.
    - *Example:* "Marketing", "Development".
    - **NOTE:** This runs AFTER the 'mongo_filter' is applied.

  - 'search_mode': Required if 'search_query' is provided. Can be either 'fuzzy' or 'semantic'.
    - 'fuzzy': Use this when the user provides a specific Workspace Name, or explicit keyword they expect to be present in the text.
    - 'semantic': Use this when the user describes a Topic, Concept, Intent, or Broad Workspace without knowing the exact titles.

  - 'limit': Max number of workspaces to return (default 50).

- **Returns:**
{{
  "workspaces": Array<Workspaces>,
  "count": number,
  "hasMore": boolean
}}
`
