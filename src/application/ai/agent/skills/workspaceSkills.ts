import { AgentSkill } from '@/application/ai/interfaces/AgentSkill.ts'

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

export const WorkspaceMoveSkill: AgentSkill = {
  name: 'WorkspaceMove',
  description:
    'Skill for moving workspace. Use this skill to change the position of existing workspace.',
  content: `
    ### SKILL: WorkspaceMove

    This skill allows you to move existing workspace. You must resolve Workspace name to ID before moving and determine the new position based on user input. Before and after workspace IDs are optional.
    If the user says "Move workspace A to the start of the workspace list", then find the first workspace by sorting by rank and use its ID as beforeWorkspaceId, leaving afterWorkspaceId null.
    By default workspace will be moved to the bottom of the list.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace id to a variable.
    - Next, in the same script, determine the new position of the workspace by identifying the beforeWorkspaceId and afterWorkspaceId. If the user says "Move workspace A before workspace B", then beforeWorkspaceId is the ID of workspace B and afterWorkspaceId is null. If the user says "Move workspace A after workspace C", then afterWorkspaceId is the ID of workspace C and beforeWorkspaceId is null. If the user says "Move workspace A between workspace B and workspace C", then beforeWorkspaceId is the ID of workspace B and afterWorkspaceId is the ID of workspace C.
    - Move the workspace using the resolved variables to call move_workspace at the end of the script.
  `,
  relatedTools: ['move_workspace', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}

export const WorkspacesDeleteSkill: AgentSkill = {
  name: 'WorkspacesDelete',
  description: 'Skill for deleting workspaces. Use this skill to remove existing workspaces.',
  content: `
    ### SKILL: WorkspacesDelete

    This skill allows you to delete existing workspaces. You must resolve Workspace name to ID before deleting.
    If the user says "Delete workspace A", then find the workspace by its name and use its ID to delete it.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - If the user says "Delete workspace A", then find the workspace by its name and use its ID to delete it using delete_workspaces at the end of the script.
    - If the user says "Delete workspaces A, B, and C", then find the workspaces by their names and use their IDs to delete them using delete_workspaces at the end of the script.
  `,
  relatedTools: ['delete_workspaces', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}

export const WorkspacesArchiveSkill: AgentSkill = {
  name: 'WorkspacesArchive',
  description: 'Skill for archiving workspaces. Use this skill to archive existing workspaces.',
  content: `
    ### SKILL: WorkspacesArchive

    This skill allows you to archive existing workspaces. You must resolve Workspace name to ID before archiving.
    If the user says "Archive workspace A", then find the workspace by its name and use its ID to archive it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT archive a workspace using names like "Archive the workspace in the Work board". You MUST first call 'search_workspaces()' to resolve the exact 'workspace_id'.
    2. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_workspaces'.
    3. **Batch Archiving:** If the user asks to archive multiple workspaces (e.g., "Archive workspaces A, B, and C"), pass all of their IDs in a single list to 'archive_workspaces'. DO NOT call 'archive_workspaces' inside a loop.
  `,
  relatedTools: ['archive_workspaces', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}

export const WorkspacesRecoverSkill: AgentSkill = {
  name: 'WorkspacesRecover',
  description: 'Skill for recovering workspaces. Use this skill to recover deleted workspaces.',
  content: `
    ### SKILL: WorkspacesRecover

    This skill allows you to recover deleted workspaces. You must resolve Workspace name to ID before recovering.
    If the user says "Recover workspace A", then find the workspace by its name and use its ID to recover it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT recover a workspace using names like "Recover the workspace in the Work board". You MUST first call 'search_workspaces()' to resolve the exact 'workspace_id'.
    2. **Search params:** You MUST use the 'isDeleted' parameter set to true when searching for workspaces to recover, otherwise you won't find any results.
    3. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'recover_workspaces'.
    4. **Batch Recovery:** If the user asks to recover multiple workspaces (e.g., "Recover workspaces A, B, and C"), pass all of their IDs in a single list to 'recover_workspaces'. DO NOT call 'recover_workspaces' inside a loop.
  `,
  relatedTools: ['recover_workspaces', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}

export const WorkspacesCloneSkill: AgentSkill = {
  name: 'WorkspacesClone',
  description: 'Skill for cloning workspaces. Use this skill to clone existing workspaces.',
  content: `
    ### SKILL: WorkspacesClone

    This skill allows you to clone existing workspaces. You must resolve Workspace name to ID before cloning.
    If the user says "Clone workspace A", then find the workspace by its name and use its ID to clone it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT clone a workspace using names like "Clone the workspace in the Work board". You MUST first call 'search_workspaces()' to resolve the exact 'workspace_id'.
    2. **Handle Ambiguity:** If your search for a workspace returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'clone_workspaces'.
    3. **Batch Cloning:** If the user asks to clone multiple workspaces (e.g., "Clone workspaces A, B, and C"), pass all of their IDs in a single list to 'clone_workspaces'. DO NOT call 'clone_workspaces' inside a loop.
  `,
  relatedTools: ['clone_workspaces', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['workspace'],
}
