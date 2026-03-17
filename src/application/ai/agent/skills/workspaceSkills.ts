import { AgentSkill } from '../../interfaces/AgentSkill.ts'

export const CloneWorkspaces: AgentSkill = {
  name: 'CloneWorkspaces',
  description: 'Create a duplicate of an existing workspace.',
  rule: `*** RULE: CLONING WORKSPACES ***
    Goal: Create a duplicate of an existing workspace.

    RULES:
    1. Identify the workspace ID(s) to be cloned.
    2. Call 'cloneWorkspaces' with the identified ID(s).
    3. If the user mentions any changes to the cloned workspace (e.g., different name), use 'update workspace tools' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneWorkspaces' with the identified ID(s).
    `,
  suggestedTools: [
    'cloneWorkspaces',
    'updateWorkspacesName',
    'updateWorkspacesColor',
    'updateWorkspacesOrder',
    'favoriteWorkspaces',
    'searchEntities',
  ],
}

export const CreateWorkspaces: AgentSkill = {
  name: 'CreateWorkspaces',
  description: 'Create a new workspace (Organization/Team Space).',
  rule: `*** RULE: CREATING WORKSPACES ***
    Goal: Create a new Workspaces (Organization/Team Space).

    Procedure:
    1. Extract the workspace 'name' from user input.
    2. If NO name is provided, generate a sensible default (e.g. "My Workspace") or ask the user.

    EXECUTION:
    - Call 'createWorkspaces' with the extracted 'name'.
    
    Note: Creating a workspace usually creates a clean slate. The user might need to create boards inside it afterwards.`,

  suggestedTools: ['createWorkspaces'],
}

export const WorkspaceLifecycle: AgentSkill = {
  name: 'WorkspaceLifecycle',
  description: 'Manage Workspace existence (archive, recover, delete).',
  rule: `*** RULE: WORKSPACE LIFECYCLE ***
    Goal: Manage Workspace existence.

    1. ARCHIVE: 'archiveWorkspaces'.
    2. RECOVER: 'recoverWorkspaces'.
    3. DELETE: 'deleteWorkspaces'.

    Procedure:
    1. Identify Workspace IDs using 'searchEntities' with isArchived flag or context.
    2. Call tool with {{ ids: ["..."] }}.`,
  suggestedTools: ['archiveWorkspaces', 'recoverWorkspaces', 'deleteWorkspaces', 'searchEntities'],
}

export const UpdateWorkspacesName: AgentSkill = {
  name: 'UpdateWorkspacesName',
  description: 'Modify the name of an existing workspace.',
  rule: `*** RULE: UPDATING WORKSPACES NAME ***
    Goal: Modify the name of an existing workspace.
    
    Procedure:
    1. If 'workspaceId' is not clear from context, search for the workspaces using 'searchEntities'.
    2. Call 'updateWorkspacesName' with 'workspaceId' and the new name.`,
  suggestedTools: ['updateWorkspacesName', 'searchEntities'],
}

export const UpdateWorkspacesOrder: AgentSkill = {
  name: 'UpdateWorkspacesOrder',
  description: 'Modify the order of an existing workspace.',
  rule: `*** RULE: UPDATING WORKSPACES ORDER ***
    Goal: Modify the order of an existing workspace.
    
    Procedure:
    1. If 'workspaceId' is not clear from context, search for the workspaces using 'searchEntities'.
    2. Call 'updateWorkspacesOrder' with 'workspaceId' and the new order.`,
  suggestedTools: ['updateWorkspacesOrder', 'searchEntities'],
}

export const FavoriteWorkspaces: AgentSkill = {
  name: 'FavoriteWorkspaces',
  description: 'Mark or unmark a workspace as favorite.',
  rule: `*** RULE: FAVORITING WORKSPACES ***
    Goal: Mark or unmark a workspace as favorite.
    
    Procedure:
    1. If 'workspaceId' is not clear from context, search for the workspaces using 'searchEntities'.
    2. Call 'favoriteWorkspaces' with 'workspaceId' and the new favorite status.`,
  suggestedTools: ['favoriteWorkspaces', 'searchEntities'],
}

export const UpdateWorkspacesColor: AgentSkill = {
  name: 'UpdateWorkspacesColor',
  description: 'Change the color of a workspace.',
  rule: `*** RULE: UPDATING WORKSPACES COLOR ***
    Goal: Change the color of a workspace.
    
    Procedure:
    1. If 'workspaceId' is not clear from context, search for the workspaces using 'searchEntities'.
    2. Call 'updateWorkspacesColor' with 'workspaceId' and the new color.`,
  suggestedTools: ['updateWorkspacesColor', 'searchEntities'],
}

export const SearchRelevantWorkspaces: AgentSkill = {
  name: 'SearchRelevantWorkspaces',
  description: 'Search and Retrieve workspaces based on similarity search by names.',
  rule: `*** RULE: SEARCHING RELEVANT WORKSPACES ***
    Goal: Search and Retrieve workspaces based on similarity search by names.
    
    Procedure:
    1. Analyze the user request to extract workspace names to search.
    2. Call 'searchRelevantWorkspaces' with the extracted workspace names.
     - If multiple workspaces are found and the user request is ambiguous, use 'showEntitiesToUser' to present the options and ask for clarification.
     - If no workspaces are found, DON'T LOOP, use 'responseToUser' to inform the user and ask for clarification or alternative input.
    3. Present results to the user using 'showEntitiesToUser' (if applicable).
    `,
  suggestedTools: ['searchRelevantWorkspaces', 'showEntitiesToUser'],
}
