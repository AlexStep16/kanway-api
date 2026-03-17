import { AgentSkill } from '../../interfaces/AgentSkill.ts'

export const UndoOperations: AgentSkill = {
  name: 'UndoOperations',
  description: 'Revert the last change made by the system.',
  rule: `*** RULE: UNDO OPERATIONS ***
    Goal: Revert the last change made by the system.
    
    Procedure:
    1. Look into the Chat History (previous Tool Outputs).
    2. Find the JSON output of the last successful modification tool (e.g., create/update/delete).
    3. Extract the 'logId' field from that output.
    4. Call 'undoOperations' with that 'logId'.

    Error Handling:
    - If you cannot find a 'logId' in the recent history, you CANNOT perform undo. Inform the user.
    - Do NOT invent a logId.`,
  suggestedTools: ['undoOperations'],
}

export const SearchEntities: AgentSkill = {
  name: 'SearchEntities',
  description: 'Search for entities based on given criteria.',
  rule: `*** RULE: SEARCH ENTITIES ***
    Goal: Find entities based on user input.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Call 'searchEntities' with the extracted criteria.
    3. Present results to the user using 'showEntitiesToUser'.`,
  suggestedTools: ['searchEntities', 'showEntitiesToUser'],
}
