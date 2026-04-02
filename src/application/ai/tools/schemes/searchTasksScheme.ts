export const searchTasksScheme = `
'search_tasks(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict'

### SCHEMA MAPPING TIPS:
- If user says "Done/Finished" -> use '{{"is_completed": True}}'.
- If user says "Active/To Do" -> use '{{"is_completed": False}}'.
- If user says "By name/Title" -> use 'search_query' argument.
- If user says "Tag" -> use '{{"tags": {{"$in": ["tag_name"]}}}}'.

- **Arguments:**
  - 'mongo_filter': Use fields and types defined in the **Task Entity** above. Base filters included by default (you don't need to add them, but you can override them if needed):
    - 'is_deleted': {{'$ne': True}
    - 'is_deleted_external': {{'$ne': True}}
  
  - 'search_query': Use this for search by task name in the selected search mode.
    - Useful when the user makes typos or asks to semantic search.
    - *Example:* "buy milk", "fix login bug".

  - 'search_mode': Required if 'search_query' is provided. Can be either 'fuzzy' or 'semantic'.
    - 'fuzzy': Use this when the user provides a specific Task Name, Title, or explicit keyword they expect to be present in the text.
    - 'semantic': Use this when the user describes a Topic, Concept, Intent, or Broad Category without knowing the exact titles.
  
  - 'limit': Max number of tasks to return (default 50).

- **Returns:**
{{
  "tasks": Array<Tasks>,
  "count": number,
  "hasMore": boolean
}}
`
