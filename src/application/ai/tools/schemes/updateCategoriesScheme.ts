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
`
