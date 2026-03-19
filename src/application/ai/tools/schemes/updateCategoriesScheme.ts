export const updateCategoriesScheme = `
'update_categories(categories: list[dict]) -> None'

- Use this tool to register the update of one or multiple existing categories.

- **Arguments:**
  - 'categories': A list of dictionaries. Each dictionary represents an existing category and MUST adhere to the **Category** database schema.

- **Returns:**
  - None. This tool only registers the intent to update categories. The actual update will occur after user confirmation.

#### CATEGORY SCHEMA FOR UPDATE:
When building a category dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- '_id': String (The ID of the category to update. You MUST find this ID first using 'search_categories' if you do not already have it).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT update a category using names like "backlog in the Work board". You MUST first call search tools to resolve ids by filters.
2. **Handle Ambiguity:** If your search for a board or category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'update_categories'.
3. **Batch Update:** If the user asks to update multiple categories (e.g., "Update categories A, B, and C"), pass all of them in a single list to 'update_categories'. DO NOT call 'update_categories' inside a loop.
4. **No Chaining After Update:** Because 'update_categories' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a category you just updated in the same script. Set all required fields during the update.
`
