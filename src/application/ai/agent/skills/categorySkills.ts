import { AgentSkill } from '../../interfaces/AgentSkill.ts'

export const MoveCategories: AgentSkill = {
  name: 'MoveCategories',
  description: 'Move categories between boards and workspaces.',
  rule: `*** RULE: MOVING CATEGORIES ***
    User wants to move a category. It could be to another board OR another workspace.

    Procedure:
    1. Extract the destination context (e.g., "to board 'Done'", "to workspace 'Marketing'").
    2. Determine if the destination is a BOARD or a WORKSPACE.
      - Look for keywords like "board", "workspace", "project".
      - If ambiguous ("move it here"), try to resolve context first.

    If Destination is a BOARD (on the current workspace):
    1. Find the target 'boardId' using 'searchEntities'.
    2. Use 'editCategories' with the found 'boardId'.

    If Destination is a WORKSPACE:
    1. Find the target WORKSPACE ID using 'searchEntities' by name.
    2. Find a suitable 'boardId' ON THE TARGET WORKSPACE using 'searchEntities' (filter by target workspaceId).
    3. Use 'editCategories' with the resolved 'boardId'.

    NEVER create or delete categories for moving. ALWAYS use 'editCategories'.
    `,
  suggestedTools: ['moveCategories', 'searchEntities'],
}

export const CloneCategories: AgentSkill = {
  name: 'CloneCategories',
  description: 'Create a duplicate of an existing category.',
  rule: `*** RULE: CLONING CATEGORIES ***
    Goal: Create a duplicate of an existing category.

    RULES:
    1. Identify the category ID(s) to be cloned.
    2. Call 'cloneCategories' with the identified ID(s).
    3. If the user mentions any changes to the cloned category (e.g., different name, board), use 'editCategories' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneCategories' with the identified ID(s).
    `,
  suggestedTools: ['cloneCategories', 'editCategories', 'searchEntities'],
}

export const CreateCategories: AgentSkill = {
  name: 'CreateCategories',
  description: 'Create a new category (column) on a board.',
  rule: `*** RULE: CREATING CATEGORIES (COLUMNS) ***
    Goal: Create a new vertical categories/lists on a board.

    IF user does not have a active board, you MUST create a new board autonomously using the 'createBoards' tool and the Relevant board name.

    Procedure:
    1. Extract the category 'name' from user input.

    2. If NO name is provided (e.g., just "Create a category"), ask the user for a name.
    3. If Board name is not provided, do not set boardName when creating the category. The system will use the active or default board.
    4. If Workspace name is not provided, do not set workspaceName when creating the category. The system will use the active workspace by default.
    5. If you know any ids from the context (e.g., boardId, workspaceId) that can help the creation, use them. The system will prioritize them over names.

    EXECUTION:
      - Call 'createCategories' with the 'name' and other relevant fields.
    `,
  suggestedTools: ['createCategories', 'searchEntities'],
}

export const UpdateCategoriesName: AgentSkill = {
  name: 'UpdateCategoriesName',
  description: 'Modify the name of an existing category.',
  rule: `*** RULE: UPDATING CATEGORIES NAME ***
    Goal: Modify the name of an existing category.
    
    Procedure:
    1. If 'categoryId' is not clear from context, search for the categories using 'searchEntities'.
    2. Call 'updateCategoriesName' with 'categoryId' and the new name.`,
  suggestedTools: ['updateCategoriesName', 'searchEntities'],
}

export const UpdateCategoriesOrder: AgentSkill = {
  name: 'UpdateCategoriesOrder',
  description: 'Modify the order of an existing category.',
  rule: `*** RULE: UPDATING CATEGORIES ORDER ***
    Goal: Modify the order of an existing category.
    
    Procedure:
    1. If 'categoryId' is not clear from context, search for the categories using 'searchEntities'.
    2. Call 'updateCategoriesOrder' with 'categoryId' and the new order.`,
  suggestedTools: ['updateCategoriesOrder', 'searchEntities'],
}

export const CategoryLifecycle: AgentSkill = {
  name: 'CategoryLifecycle',
  description: 'Change the existence state of a category (archive, recover, delete).',
  rule: `*** RULE: CATEGORY LIFECYCLE (ARCHIVE / DELETE / RECOVER) ***
    Goal: Change the existence state of a Category (Column).

    1. ARCHIVE (Soft Delete):
      - Tool: 'archiveCategories'.
      - Use for "remove", "hide", "archive".

    2. RECOVER (Restore):
      - Tool: 'recoverCategories'.

    3. DELETE (Permanent):
      - Tool: 'deleteCategories'.
      - WARNING: Deleting a category usually deletes/archives all tasks inside it.

    Procedure:
    1. Identify Category IDs using 'searchEntities' with isArchived flag or context.
    2. Call tool with {{ ids: ["..."] }}.`,
  suggestedTools: ['archiveCategories', 'recoverCategories', 'deleteCategories', 'searchEntities'],
}

export const SearchRelevantCategories: AgentSkill = {
  name: 'SearchRelevantCategories',
  description: 'Search and Retrieve categories based on similarity search by names.',
  rule: `*** RULE: SEARCHING RELEVANT CATEGORIES ***
    Goal: Search and Retrieve categories based on similarity search by names.
    
    Procedure:
    1. Analyze the user request to extract category names to search.
    2. Call 'searchRelevantCategories' with the extracted category names.
     - If multiple categories are found and the user request is ambiguous, use 'showEntitiesToUser' to present the options and ask for clarification.
     - If no categories are found, DON'T LOOP, use 'responseToUser' to inform the user and ask for clarification or alternative input.
    3. Present results to the user using 'showEntitiesToUser' (if applicable).
    `,
  suggestedTools: ['searchRelevantCategories', 'showEntitiesToUser'],
}
