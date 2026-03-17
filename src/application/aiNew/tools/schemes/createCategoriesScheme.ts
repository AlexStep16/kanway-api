export const createCategoriesScheme = `
'create_categories(categories: list[dict]) -> None'

- Use this tool to register the creation of one or multiple new categories.

- **Arguments:**
  - 'categories': A list of dictionaries. Each dictionary represents a new category and MUST adhere to the **Category** database schema.

- **Returns:**
  - None. This tool only registers the intent to create categories. The actual creation will occur after user confirmation.

#### CATEGORY SCHEMA FOR CREATION:
When building a category dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the category).
- 'board': String (The ID of the board it belongs to. You MUST find this ID first using 'search_boards' or search).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT create a category using names like "in the Work board". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'create_categories'.
3. **Batch Creation:** If the user asks to create multiple categories (e.g., "Create categories A, B, and C"), pass all of them in a single list to 'create_categories'. DO NOT call 'create_categories' inside a loop.
4. **No Chaining After Creation:** Because 'create_categories' only *registers* an intent (the DB is not modified immediately), you CANNOT search for or update a category you just created in the same script. Set all required fields (like 'order') during creation.
`
