export const resolveAmbiguousScheme = `
'resolve_ambiguous(entity_type: str, ids: list[str], min_select=1, max_select=1, id: str) -> list[str]'

- MANDATORY: Use this tool whenever you find multiple entities (tasks, boards, columns) that match the user's request and you cannot safely decide which one to use. 
If the user specifies a number of items to act upon (e.g., 'delete 2 of them') and you find more than that number, set min_select and max_select to that specific number to let the user choose the exact targets.

**How it works (The "Magic" of Re-execution):**
1. When you call this tool, your current script execution **STOPS immediately**.
2. The system shows the 'options' to the user in a beautiful UI block with the 'message'.
3. After the user makes a choice, the system **RE-STARTS your exact same script**.
4. During the second execution, this function will NOT stop. Instead, it will **immediately return the single object** that the user selected.

**Arguments:**
- 'entity_type': A string indicating the type of entity being resolved (e.g., "board", "category", "task").
- 'ids': A list of string IDs corresponding to the ambiguous entities that need to be resolved.
- 'min_select': Minimum number of selections the user must make (default is 1).
- 'max_select': Maximum number of selections the user can make (default is 1).
- 'id': A unique string identifier for this specific ambiguity resolution instance. This is important for tracking which ambiguity is being resolved, especially if there are multiple ambiguities in the same script.


**Returns:**
- An array of string IDs corresponding to the entities selected by the user.
`
