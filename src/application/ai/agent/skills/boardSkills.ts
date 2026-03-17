import { AgentSkill } from '../../interfaces/AgentSkill.ts'

export const MoveBoards: AgentSkill = {
  name: 'MoveBoards',
  description: 'Move one or more boards to a different workspace.',
  rule: `*** RULE: MOVING BOARDS ***
    1. Find the target 'workspaceId' using 'searchEntities'.
    2. Use 'moveBoards' with the found 'workspaceId'.

    NEVER create or delete boards for moving. ALWAYS use 'moveBoards'.
    `,
  suggestedTools: ['moveBoards', 'searchEntities'],
}

export const CloneBoards: AgentSkill = {
  name: 'CloneBoards',
  description: 'Create a duplicate of an existing board.',
  rule: `*** RULE: CLONING BOARDS ***
    Goal: Create a duplicate of an existing board.

    RULES:
    1. Identify the board ID(s) to be cloned.
    2. Call 'cloneBoards' with the identified ID(s).
    3. If the user mentions any changes to the cloned board (e.g., different name, workspace), use 'update tools' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneBoards' with the identified ID(s).
    `,
  suggestedTools: [
    'cloneBoards',
    'updateBoardsOrder',
    'updateBoardsName',
    'favoriteBoards',
    'searchEntities',
  ],
}

export const CreateBoards: AgentSkill = {
  name: 'CreateBoards',
  description: 'Create new boards in a specified workspace.',
  rule: `*** RULE: CREATING BOARDS ***
    Goal: Create new boards.

    Procedure:
    1. Extract the board 'name' from user input.
    2. If NO name is provided (e.g., just "Create a board"), ask the user for a name.
    3. If workspace name is not provided, do not set workspaceName when creating the board. The system will use the active workspace by default.
    4. If you know any ids from the context (e.g., workspaceId) that can help the creation, use them. The system will prioritize them over names.

    EXECUTION:
    - Call 'createBoards' with the extracted names and other relevant parameters.
  `,

  suggestedTools: ['createBoards', 'searchEntities'],
}

export const UpdateBoardsName: AgentSkill = {
  name: 'UpdateBoardsName',
  description: 'Modify the name of an existing board.',
  rule: `*** RULE: UPDATING BOARDS NAME ***
    Goal: Modify the name of an existing board.
    
    Procedure:
    1. If 'boardId' is not clear from context, search for the boards using 'searchEntities'.
    2. Call 'updateBoardsName' with 'boardId' and the new name.`,
  suggestedTools: ['updateBoardsName', 'searchEntities'],
}

export const UpdateBoardsOrder: AgentSkill = {
  name: 'UpdateBoardsOrder',
  description: 'Modify the order of an existing board.',
  rule: `*** RULE: UPDATING BOARDS ORDER ***
    Goal: Modify the order of an existing board.
    
    Procedure:
    1. If 'boardId' is not clear from context, search for the boards using 'searchEntities'.
    2. Call 'updateBoardsOrder' with 'boardId' and the new order.`,
  suggestedTools: ['updateBoardsOrder', 'searchEntities'],
}

export const FavoriteBoards: AgentSkill = {
  name: 'FavoriteBoards',
  description: 'Mark or unmark a board as favorite.',
  rule: `*** RULE: FAVORITING BOARDS ***
    Goal: Mark or unmark a board as favorite.
    
    Procedure:
    1. If 'boardId' is not clear from context, search for the boards using 'searchEntities'.
    2. Call 'favoriteBoards' with 'boardId' and the new favorite status.`,
  suggestedTools: ['favoriteBoards', 'searchEntities'],
}

export const BoardLifecycle: AgentSkill = {
  name: 'BoardLifecycle',
  description: 'Manage the lifecycle of a board (archive, recover, delete).',
  rule: `*** RULE: BOARD LIFECYCLE (ARCHIVE / DELETE / RECOVER) ***
    Goal: Change the existence state of a Board.

    1. ARCHIVE (Close/Soft Delete):
      - Tool: 'archiveBoards'.
      - Use for "close project", "archive board", "remove".

    2. RECOVER (Reopen):
      - Tool: 'recoverBoards'.
      - Use for "reopen", "restore".

    3. DELETE (Permanent):
      - Tool: 'deleteBoards'.
      - WARNING: Destroys all categories and tasks inside. Use ONLY for explicit "delete forever" requests.

    Procedure:
    1. Identify Board IDs using 'searchEntities' with isArchived flag or context.
    2. Call tool with {{ ids: ["..."] }}.`,
  suggestedTools: ['archiveBoards', 'recoverBoards', 'deleteBoards', 'searchEntities'],
}

export const SearchRelevantBoards: AgentSkill = {
  name: 'SearchRelevantBoards',
  description: 'Search and Retrieve boards based on similarity search by names.',
  rule: `*** RULE: SEARCHING RELEVANT BOARDS ***
    Goal: Search and Retrieve boards based on similarity search by names.
    
    Procedure:
    1. Analyze the user request to extract boards names to search.
    2. Call 'searchRelevantBoards' with the extracted board names.
     - If multiple boards are found and the user request is ambiguous, use 'showEntitiesToUser' to present the options and ask for clarification.
     - If no boards are found, DON'T LOOP, use 'responseToUser' to inform the user and ask for clarification or alternative input.
    3. Present results to the user using 'showEntitiesToUser' (if applicable).
    `,
  suggestedTools: ['searchRelevantBoards', 'showEntitiesToUser'],
}
