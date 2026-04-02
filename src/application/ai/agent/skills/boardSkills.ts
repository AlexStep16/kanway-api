import { AgentSkill } from '@/application/ai/interfaces/AgentSkill.ts'

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
  relatedEntities: ['board', 'workspace'],
}

export const BoardsUpdateSkill: AgentSkill = {
  name: 'BoardsUpdate',
  description:
    'Skill for updating boards. Use this skill to modify existing boards. Also for moving boards between workspaces.',
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
  relatedEntities: ['board', 'workspace'],
}

export const BoardMoveSkill: AgentSkill = {
  name: 'BoardMove',
  description:
    'Skill for moving board. Use this skill to change the position of existing board. Not for moving multiple boards between workspaces.',
  content: `
    ### SKILL: BoardMove

    This skill allows you to move existing board. You must resolve Board name to ID before moving and determine the new position based on user input. Before and after board IDs are optional.
    If the user says "Move board A to the start of the workspace", then find the first board in the workspace by sorting by rank and use its ID as beforeBoardId, leaving afterBoardId null.
    By default board will be moved to the bottom of the workspace.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Board Resolution: First, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board id to a variable.
    - Next, in the same script, determine the new position of the board by identifying the beforeBoardId and afterBoardId. If the user says "Move board A before board B", then beforeBoardId is the ID of board B and afterBoardId is null. If the user says "Move board A after board C", then afterBoardId is the ID of board C and beforeBoardId is null. If the user says "Move board A between board B and board C", then beforeBoardId is the ID of board B and afterBoardId is the ID of board C.
    - If the user says "Move board A to workspace D", resolve workspace D by 'search_workspaces' to get newWorkspaceId.
    - Move the board using the resolved variables to call move_board at the end of the script.
  `,
  relatedTools: ['move_board', 'search_boards', 'search_workspaces', 'resolve_ambiguous'],
  relatedEntities: ['board', 'workspace'],
}

export const BoardsDeleteSkill: AgentSkill = {
  name: 'BoardsDelete',
  description: 'Skill for deleting boards. Use this skill to remove existing boards.',
  content: `
    ### SKILL: BoardsDelete

    This skill allows you to delete existing boards. You must resolve Board name to ID before deleting.
    If the user says "Delete board A", then find the board by its name and use its ID to delete it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT delete a board using names like "Delete the board in the Work workspace". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
    2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'delete_boards'.
    3. **Batch Deletion:** If the user asks to delete multiple boards (e.g., "Delete boards A, B, and C"), pass all of their IDs in a single list to 'delete_boards'. DO NOT call 'delete_boards' inside a loop.
  `,
  relatedTools: ['delete_boards', 'search_boards', 'resolve_ambiguous'],
  relatedEntities: ['board'],
}

export const BoardsArchiveSkill: AgentSkill = {
  name: 'BoardsArchive',
  description: 'Skill for archiving boards. Use this skill to archive existing boards.',
  content: `
    ### SKILL: BoardsArchive

    This skill allows you to archive existing boards. You must resolve Board name to ID before archiving.
    If the user says "Archive board A", then find the board by its name and use its ID to archive it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT archive a board using names like "Archive the board in the Work workspace". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
    2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'archive_boards'.
    3. **Batch Archiving:** If the user asks to archive multiple boards (e.g., "Archive boards A, B, and C"), pass all of their IDs in a single list to 'archive_boards'. DO NOT call 'archive_boards' inside a loop.
  `,
  relatedTools: ['archive_boards', 'search_boards', 'resolve_ambiguous'],
  relatedEntities: ['board'],
}

export const BoardsRecoverSkill: AgentSkill = {
  name: 'BoardsRecover',
  description: 'Skill for recovering boards. Use this skill to recover deleted boards.',
  content: `
    ### SKILL: BoardsRecover

    This skill allows you to recover deleted boards. You must resolve Board name to ID before recovering.
    If the user says "Recover board A", then find the board by its name and use its ID to recover it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT recover a board using names like "Recover the board in the Work workspace". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
    2. **Search params:** You MUST use the 'isDeleted' parameter set to true when searching for boards to recover, otherwise you won't find any results.
    3. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'recover_boards'.
    4. **Batch Recovery:** If the user asks to recover multiple boards (e.g., "Recover boards A, B, and C"), pass all of their IDs in a single list to 'recover_boards'. DO NOT call 'recover_boards' inside a loop.
  `,
  relatedTools: ['recover_boards', 'search_boards', 'resolve_ambiguous'],
  relatedEntities: ['board'],
}

export const BoardsCloneSkill: AgentSkill = {
  name: 'BoardsClone',
  description: 'Skill for cloning boards. Use this skill to clone existing boards.',
  content: `
    ### SKILL: BoardsClone

    This skill allows you to clone existing boards. You must resolve Board name to ID before cloning.
    If the user says "Clone board A", then find the board by its name and use its ID to clone it.

    #### USAGE STRATEGY & RULES:
    1. **Find Context First:** You CANNOT clone a board using names like "Clone the board in the Work workspace". You MUST first call 'search_boards()' to resolve the exact 'board_id'.
    2. **Handle Ambiguity:** If your search for a board returns multiple matches, you MUST call 'resolve_ambiguous' to let the user pick the correct ID before calling 'clone_boards'.
    3. **Batch Cloning:** If the user asks to clone multiple boards (e.g., "Clone boards A, B, and C"), pass all of their IDs in a single list to 'clone_boards'. DO NOT call 'clone_boards' inside a loop.
  `,
  relatedTools: ['clone_boards', 'search_boards', 'resolve_ambiguous'],
  relatedEntities: ['board'],
}
