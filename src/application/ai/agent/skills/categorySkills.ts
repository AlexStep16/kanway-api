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
  description: 'Skill for updating categories. Use this skill to modify existing categories.',
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
    'Skill for moving category. Use this skill to change the position of existing category.',
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
