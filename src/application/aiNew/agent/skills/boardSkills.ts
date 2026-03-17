import { AgentSkill } from '@/application/aiNew/interfaces/AgentSkill.ts'

export const BoardsReadSkill: AgentSkill = {
  name: 'BoardsRead',
  description:
    'Skill for reading and understanding boards. Use this skill to extract key information from boards, such as objectives, requirements, and constraints.',
  content: `
    ### SKILL: BoardsRead

    This skill allows you to find boards using either strict criteria, fuzzy text search, or both.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - **Hybrid Search:** If the user says "Find favorite boards called work", use BOTH arguments:
      - 'mongo_filter={"is_favorite": True}' (Strict)
      - 'search_query="work"' (Fuzzy)
    - **Pure Fuzzy:** If the user says "Search for 'board Life'", use ONLY 'search_query="board Life"'.
    - **Pure Strict:** If the user says "Show all archived boards", use ONLY 'mongo_filter={"is_deleted": True}'.
  `,
  relatedTools: ['search_boards', 'display_to_user'],
  relatedEntities: ['board'],
}

export const BoardsCreateSkill: AgentSkill = {
  name: 'BoardsCreate',
  description: 'Skill for creating boards. Use this skill to add new boards.',
  content: `
    ### SKILL: BoardsCreate

    This skill allows you to create new boards. You must resolve Workspace names to IDs before creation.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Creation: Finally, use the resolved variables to call create_boards at the end of the script.
  `,
  relatedTools: ['create_boards', 'search_boards', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['board'],
}

export const BoardsUpdateSkill: AgentSkill = {
  name: 'BoardsUpdate',
  description: 'Skill for updating boards. Use this skill to modify existing boards.',
  content: `
    ### SKILL: BoardsUpdate

    This skill allows you to update existing boards. You must resolve Workspace and Board names to IDs before updating.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Board Resolution: Next, in the same script, query for the board. Handle ambiguity the same way.
    - Update: Finally, use the resolved variables to call update_boards at the end of the script.
  `,
  relatedTools: ['update_boards', 'search_boards', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['board'],
}
