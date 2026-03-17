import { AgentSkill } from '@/application/aiNew/interfaces/AgentSkill.ts'

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
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Board Resolution: Next, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board_id to a variable.
    - Creation: Finally, use the resolved variables to call create_categories at the end of the script.
  `,
  relatedTools: ['create_categories', 'search_boards', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['category'],
}

export const CategoriesUpdateSkill: AgentSkill = {
  name: 'CategoriesUpdate',
  description: 'Skill for updating categories. Use this skill to modify existing categories.',
  content: `
    ### SKILL: CategoriesUpdate

    This skill allows you to update existing categories. You must resolve Workspace, Board, and Category names to IDs before updating.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Board Resolution: Next, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board_id to a variable.
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
  relatedEntities: ['category'],
}
