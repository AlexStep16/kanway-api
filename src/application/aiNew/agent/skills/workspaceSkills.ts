import { AgentSkill } from '@/application/aiNew/interfaces/AgentSkill.ts'

export const WorkspacesReadSkill: AgentSkill = {
  name: 'WorkspacesRead',
  description:
    'Skill for reading and understanding workspaces. Use this skill to extract key information from workspaces, such as objectives, requirements, and constraints.',
  content: `
    ### SKILL: WorkspacesRead

    This skill allows you to find workspaces using either strict criteria, fuzzy text search, or both.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - **Hybrid Search:** If the user says "Find favorite workspaces called Personal", use BOTH arguments:
      - 'mongo_filter={"is_favorite": True}' (Strict)
      - 'search_query="Personal"' (Fuzzy)
    - **Pure Fuzzy:** If the user says "Search for 'workspace Personal'", use ONLY 'search_query="workspace Personal"'.
    - **Pure Strict:** If the user says "Show all archived workspaces", use ONLY 'mongo_filter={"is_deleted": True}'.
  `,
  relatedTools: ['search_workspaces', 'display_to_user'],
  relatedEntities: ['workspace'],
}

export const WorkspacesCreateSkill: AgentSkill = {
  name: 'WorkspacesCreate',
  description: 'Skill for creating workspaces. Use this skill to add new workspaces.',
  content: `
    ### SKILL: WorkspacesCreate

    This skill allows you to create new workspaces.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Creation: Use 'create_workspaces' with appropriate arguments.
  `,
  relatedTools: ['create_workspaces', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}

export const WorkspacesUpdateSkill: AgentSkill = {
  name: 'WorkspacesUpdate',
  description: 'Skill for updating workspaces. Use this skill to modify existing workspaces.',
  content: `
    ### SKILL: WorkspacesUpdate

    This skill allows you to update existing workspaces.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Update: Finally, use the resolved variables to call update_workspaces at the end of the script.
  `,
  relatedTools: ['update_workspaces', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}
