export const archiveCategoriesScheme = `
'archive_categories(ids: list[string]) -> None'

- Use this tool to register the archiving of one or multiple new categories.

- **Arguments:**
  - 'ids': A list of string IDs representing the categories to be archived.
---

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT archive a category using names like "Archive the category in the Work board". You MUST first call 'search_categories()' to resolve the exact 'category_id'.
2. **Handle Ambiguity:** If your search for a category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_categories'.
3. **Batch Archiving:** If the user asks to archive multiple categories (e.g., "Archive categories A, B, and C"), pass all of their IDs in a single list to 'archive_categories'. DO NOT call 'archive_categories' inside a loop.
`
