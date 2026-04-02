import { AgentSkill } from '@/application/ai/interfaces/AgentSkill.ts'

export const CategoriesReadSkill: AgentSkill = {
  name: 'CategoriesRead',
  description:
    'Skill for reading and understanding categories. Use this skill to extract key information from categories, such as objectives, requirements, and constraints.',
  content: `
    ### SKILL: CategoriesRead

    This skill allows you to find categories using either strict criteria, fuzzy text search, or both.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - **Hybrid Search:** If the user says "Find archived categories called backlog", use BOTH arguments:
      - 'mongo_filter={"is_deleted": True}' (Strict)
      - 'search_query="backlog"' (Fuzzy)
    - **Pure Fuzzy:** If the user says "Search for 'project alpha'", use ONLY 'search_query="project alpha"'.
    - **Pure Strict:** If the user says "Show all archived categories", use ONLY 'mongo_filter={"is_deleted": True}'.
  `,
  relatedTools: ['search_categories', 'display_to_user'],
  relatedEntities: ['category'],
}

export const CategoriesCreateSkill: AgentSkill = {
  name: 'CategoriesCreate',
  description: 'Skill for creating categories. Use this skill to add new categories.',
  content: `
    ### SKILL: CategoriesCreate

    This skill allows you to create new categories. You must resolve Workspace and Board names to IDs before creation.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace id to a variable.
    - Board Resolution: Next, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board id to a variable.
    - Creation: Finally, use the resolved variables to call create_categories at the end of the script.
  `,
  relatedTools: ['create_categories', 'search_boards', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['category', 'board', 'workspace'],
}

export const CategoriesUpdateSkill: AgentSkill = {
  name: 'CategoriesUpdate',
  description:
    'Skill for updating categories. Use this skill to modify existing categories. Also for moving categories between boards.',
  content: `
    ### SKILL: CategoriesUpdate

    This skill allows you to update existing categories. You must resolve Workspace, Board, and Category names to IDs before updating.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace id to a variable.
    - Board Resolution: Next, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board id to a variable.
    - Category Resolution: Next, in the same script, query for the category. Handle ambiguity the same way.
    - Update: Finally, use the resolved variables to call update_categories at the end of the script.
  `,
  relatedTools: [
    'update_categories',
    'search_categories',
    'search_workspaces',
    'search_boards',
    'resolve_ambiguous',
  ],
  relatedEntities: ['category', 'board', 'workspace'],
}

export const CategoryMoveSkill: AgentSkill = {
  name: 'CategoryMove',
  description:
    'Skill for moving category. Use this skill to change the position of existing category. Not for moving multiple categories between boards.',
  content: `
    ### SKILL: CategoryMove

    This skill allows you to move existing category. You must resolve Category name to ID before moving and determine the new position based on user input. Before and after category IDs are optional.
    If the user says "Move category A to the start of the board", then find the first category in the board by sorting by rank and use its ID as beforeCategoryId, leaving afterCategoryId null.
    By default category will be moved to the bottom of the board.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Category Resolution: First, query for the category. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the category id to a variable.
    - Next, in the same script, determine the new position of the category by identifying the beforeCategoryId and afterCategoryId. If the user says "Move category A before category B", then beforeCategoryId is the ID of category B and afterCategoryId is null. If the user says "Move category A after category C", then afterCategoryId is the ID of category C and beforeCategoryId is null. If the user says "Move category A between category B and category C", then beforeCategoryId is the ID of category B and afterCategoryId is the ID of category C.
    - If the user says "Move category A to board D", resolve board D by 'search_boards' to get newBoardId.
    - Move the category using the resolved variables to call move_category at the end of the script.
  `,
  relatedTools: ['move_category', 'search_categories', 'search_boards', 'resolve_ambiguous'],
  relatedEntities: ['category', 'board'],
}

export const CategoriesDeleteSkill: AgentSkill = {
  name: 'CategoriesDelete',
  description: 'Skill for deleting categories. Use this skill to remove existing categories.',
  content: `
    ### SKILL: CategoriesDelete

    This skill allows you to delete existing categories. You must resolve Category name to ID before deleting.
    If the user says "Delete category A", then find the category by its name and use its ID to delete it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT delete a category using names like "Delete the category in the Work board". You MUST first call 'search_categories()' to resolve the exact 'category_id'.
    2. **Handle Ambiguity:** If your search for a category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'delete_categories'.
    3. **Batch Deletion:** If the user asks to delete multiple categories (e.g., "Delete categories A, B, and C"), pass all of their IDs in a single list to 'delete_categories'. DO NOT call 'delete_categories' inside a loop.
  `,
  relatedTools: ['delete_categories', 'search_categories', 'resolve_ambiguous'],
  relatedEntities: ['category'],
}

export const CategoriesArchiveSkill: AgentSkill = {
  name: 'CategoriesArchive',
  description: 'Skill for archiving categories. Use this skill to archive existing categories.',
  content: `
    ### SKILL: CategoriesArchive

    This skill allows you to archive existing categories. You must resolve Category name to ID before archiving.
    If the user says "Archive category A", then find the category by its name and use its ID to archive it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT archive a category using names like "Archive the category in the Work board". You MUST first call 'search_categories()' to resolve the exact 'category_id'.
    2. **Handle Ambiguity:** If your search for a category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_categories'.
    3. **Batch Archiving:** If the user asks to archive multiple categories (e.g., "Archive categories A, B, and C"), pass all of their IDs in a single list to 'archive_categories'. DO NOT call 'archive_categories' inside a loop.
  `,
  relatedTools: ['archive_categories', 'search_categories', 'resolve_ambiguous'],
  relatedEntities: ['category'],
}

export const CategoriesRecoverSkill: AgentSkill = {
  name: 'CategoriesRecover',
  description: 'Skill for recovering categories. Use this skill to recover deleted categories.',
  content: `
    ### SKILL: CategoriesRecover

    This skill allows you to recover deleted categories. You must resolve Category name to ID before recovering.
    If the user says "Recover category A", then find the category by its name and use its ID to recover it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT recover a category using names like "Recover the category in the Work board". You MUST first call 'search_categories()' to resolve the exact 'category_id'.
    2. **Search params:** You MUST use the 'isDeleted' parameter set to true when searching for categories to recover, otherwise you won't find any results.
    3. **Handle Ambiguity:** If your search for a category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'recover_categories'.
    4. **Batch Recovery:** If the user asks to recover multiple categories (e.g., "Recover categories A, B, and C"), pass all of their IDs in a single list to 'recover_categories'. DO NOT call 'recover_categories' inside a loop.
  `,
  relatedTools: ['recover_categories', 'search_categories', 'resolve_ambiguous'],
  relatedEntities: ['category'],
}

export const CategoriesCloneSkill: AgentSkill = {
  name: 'CategoriesClone',
  description: 'Skill for cloning categories. Use this skill to clone existing categories.',
  content: `
    ### SKILL: CategoriesClone

    This skill allows you to clone existing categories. You must resolve Category name to ID before cloning.
    If the user says "Clone category A", then find the category by its name and use its ID to clone it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT clone a category using names like "Clone the category in the Work board". You MUST first call 'search_categories()' to resolve the exact 'category_id'.
    2. **Handle Ambiguity:** If your search for a category returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'clone_categories'.
    3. **Batch Cloning:** If the user asks to clone multiple categories (e.g., "Clone categories A, B, and C"), pass all of their IDs in a single list to 'clone_categories'. DO NOT call 'clone_categories' inside a loop.
  `,
  relatedTools: ['clone_categories', 'search_categories', 'resolve_ambiguous'],
  relatedEntities: ['category'],
}
