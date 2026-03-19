export const createCategoriesScheme = `
'create_categories(categories: list[dict]) -> list[string]'

- Use this tool to register the creation of one or multiple new categories.

- **Arguments:**
  - 'categories': A list of dictionaries. Each dictionary represents a new category and MUST adhere to the **Category** database schema.

- **Returns:** A list of string IDs corresponding to the created categories.

#### ⚠️ CRITICAL RULE: VIRTUAL IDs & CHAINING
The IDs returned by 'create_categories' are **VIRTUAL/TEMPORARY**. category creation is deferred, meaning the categories are NOT actually saved to the database until the entire script finishes executing.

- ✅ **ALLOWED (Chaining):** You MAY pass these returned virtual IDs directly into other tools within the same script (e.g., 'move_category', 'update_categories', 'delete_category'). The system will automatically resolve them later.
- ❌ **FORBIDDEN (Searching):** You MUST NOT use 'search_categories' to look for categories you just created. Because they are not in the database yet, any search will return 0 results and break your logic.

**Example of CORRECT usage:**
\`\`\`python
new_ids = create_categories([{"name": "Groceries", ...}])
# Passing the virtual ID directly to another tool is ALLOWED:
move_category(id=new_ids[0], ...)
\`\`\`

**Example of WRONG usage (DO NOT DO THIS):**
\`\`\`python
create_categories([{"name": "Groceries", ...}])
# Searching for the category you just created is FORBIDDEN (it will fail):
categories = search_categories(search_query="Groceries") 
\`\`\`

---

#### CATEGORY SCHEMA FOR CREATION:
When building a category dictionary, you MUST use the following fields and types. Do not invent field names.

**Required Fields:**
- 'name': String (The title of the category).
- 'board': String (The ID of the board it belongs to. You MUST find this ID first using 'search_boards' or search).

#### USAGE STRATEGY & RULES:
1. **Find Context First:** You CANNOT create a category using names like "in the Work board". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'create_categories'.
3. **Batch Creation:** If the user asks to create multiple categories (e.g., "Create categories A, B, and C"), pass all of them in a single list to 'create_categories'. DO NOT call 'create_categories' inside a loop.
`
