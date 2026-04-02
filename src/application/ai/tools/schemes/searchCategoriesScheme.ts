export const searchCategoriesScheme = `
'search_categories(mongo_filter: dict = None, search_query: str = None, search_mode: str = None, limit: int = 50) -> dict'

### SCHEMA MAPPING TIPS:
- If user says "By name/Title" -> use 'search_query' argument.

- **Arguments:**
  - 'mongo_filter': Use fields and types defined in the **Category Entity** above. Base filters included by default (you don't need to add them, but you can override them if needed):
    - 'is_deleted': {{'$ne': True}
    - 'is_deleted_external': {{'$ne': True}}

  - 'search_query': Use this for FUZZY search by category name.
    - Useful when the user makes typos or asks to semantic search.
    - *Example:* "Marketing", "Development".

  - 'search_mode': Required if 'search_query' is provided. Can be either 'fuzzy' or 'semantic'.
    - 'fuzzy': Use this when the user provides a specific Category Name, or explicit keyword they expect to be present in the text.
    - 'semantic': Use this when the user describes a Topic, Concept, Intent, or Broad Category without knowing the exact titles.

  - 'limit': Max number of categories to return (default 50).

- **Returns:**
{{
  "categories": Array<Categories>,
  "count": number,
  "hasMore": boolean
}}
`
