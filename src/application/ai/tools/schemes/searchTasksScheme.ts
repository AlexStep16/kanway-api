export const searchTasksScheme = `
'search_tasks(mongo_filter: dict = None, search_query: str = None, limit: int = 50) -> dict'

### SCHEMA MAPPING TIPS:
- If user says "Done/Finished" -> use '{{"is_completed": True}}'.
- If user says "Active/To Do" -> use '{{"is_completed": False}}'.
- If user says "By name/Title" -> use 'search_query' argument.
- If user says "Tag" -> use '{{"tags": {{"$in": ["tag_name"]}}}}'.

- **Arguments:**
  - 'mongo_filter': Use fields and types defined in the **Task Entity** above. Base filters included by default (you don't need to add them, but you can override them if needed):
    - 'is_deleted': {{'$ne': True}
    - 'is_deleted_external': {{'$ne': True}}
  
  - 'search_query': Use this for FUZZY search by task name.
    - Useful when the user makes typos or remembers only part of the name.
    - *Example:* "buy milk", "fix login bug".
    - **NOTE:** This runs AFTER the 'mongo_filter'.
  
  - 'limit': Max number of tasks to return (default 50).

- **Returns:**:
{{
  "tasks": Array<Tasks>,
  "count": number,
  "hasMore": boolean
}}
`
