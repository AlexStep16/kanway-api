export const searchWorkspacesScheme = `
'search_workspaces(search_query: str = None, mongo_filter: dict = None) -> list[dict]'

### SCHEMA MAPPING TIPS:
- If user says "By name/Title" -> use 'search_query' argument.
- If user says "Favorite" -> use '{{"is_favorite": True}}'.
- If user says "Archived" -> use '{{"is_deleted": True}}'.

- **Arguments:**
  - 'mongo_filter': Use fields and types defined in the **Workspace Entity** above. Base filters to always include:
    - 'is_deleted': {{'$ne': True}
    - 'user_id': ObjectId of the user (must be included for all queries).

  - 'search_query': Use this for FUZZY search by workspace name.
    - Useful when the user makes typos or remembers only part of the name.
    - *Example:* "Marketing", "Development".
    - **NOTE:** This runs AFTER the 'mongo_filter' is applied.

- **Returns:**: A list of workspaces matching the criteria, each with fields defined in the **Workspace Entity Schema**.
`
