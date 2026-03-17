import { AgentSkill } from '../../interfaces/AgentSkill.ts'

export const TaskSkills: AgentSkill = {
  name: 'TaskCompletion',
  description: 'Change the completion status of a task (Done / Not Done).',
  rule: `*** RULE: TASK COMPLETION ***
    Goal: Change the completion status of a task (Done / Not Done).

    Mapping:
    - "Complete", "Mark as done", "Move to done" -> Set 'isCompleted' to true.
    - "Uncomplete", "Reopen", "Move to todo" -> Set 'isCompleted' to false.

    Procedure:
    1. Identify the task ID.
    2. Call 'completeTasks' to update the isCompleted field.
    `,
  suggestedTools: ['completeTasks', 'searchEntities'],
}

export const MoveTasks: AgentSkill = {
  name: 'MoveTasks',
  description: 'Move tasks between categories and boards.',
  rule: `*** RULE: MOVING TASKS ***
    User wants to move a task. It could be to another column OR another board.

    Procedure:
    1. Extract the destination context (e.g., "to column 'Done'", "to board 'Marketing'").
    2. Determine if the destination is a COLUMN or a BOARD.
      - Look for keywords like "column", "category", "list", "board".
      - If ambiguous ("move it here"), try to resolve context first.

    If Destination is a COLUMN (on the current board):
    1. Find the target 'categoryId' using 'searchEntities'.
    2. Use 'editTasks' with the found 'categoryId'.

    If Destination is a BOARD:
    1. Find the target BOARD using 'searchEntities' by name.
    2. Find a suitable Category ON THE TARGET BOARD using 'searchEntities' (filter by target boardId).
    3. Use 'moveTasks' with the resolved 'categoryId'.

    NEVER create or delete tasks for moving. ALWAYS use 'moveTasks'.
    `,
  suggestedTools: ['moveTasks', 'searchEntities'],
}

export const CloneTasks: AgentSkill = {
  name: 'CloneTasks',
  description: 'Create a duplicate of an existing task.',
  rule: `*** RULE: CLONING TASKS ***
    Goal: Create a duplicate of an existing task.

    RULES:
    1. Identify the task ID(s) to be cloned.
    2. Call 'cloneTasks' with the identified ID(s).
    3. If the user mentions any changes to the cloned task (e.g., different name, category), use 'update tools' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneTasks' with the identified ID(s).
    `,
  suggestedTools: [
    'cloneTasks',
    'updateTasksName',
    'updateTasksDescription',
    'updateTasksDueDate',
    'updateTasksDueTime',
    'updateTasksTags',
    'updateTasksColor',
    'updateTasksOrder',
    'searchEntities',
  ],
}

export const CreateTasks: AgentSkill = {
  name: 'CreateTasks',
  description: 'Create a new tasks in a specified category.',
  rule: `*** RULE: CREATING TASKS ***
    Goal: Create a new tasks. You must decide the best Category (Column) based on user input.
    
    IF user does not have a active board, you MUST create a new board autonomously using the 'createBoards' tool and the default names provided in the context variables.

    Procedure:
    1. Extract the tasks 'name' from user input.

    2. If NO name is provided (e.g., just "Create a task"), ask the user for a name.
    3. If Category name is not provided, do not set categoryName when creating the task. The system will use the default category by default.
    4. If Board name is not provided, do not set boardName when creating the task. The system will use the active or default board.
    5. If Workspace name is not provided, do not set workspaceName when creating the task. The system will use the active workspace by default.
    6. If you know any ids from the context (e.g., categoryId, boardId) that can help the creation, use them. The system will prioritize them over names.

    EXECUTION:
      - Call 'createTasks' with the 'name' and other relevant fields.
    `,
  suggestedTools: ['createTasks', 'searchEntities'],
}

export const UpdateTasksName: AgentSkill = {
  name: 'UpdateTasksName',
  description: 'Modify the name of an existing task.',
  rule: `*** RULE: UPDATING TASKS NAME ***
    Goal: Modify the name of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. Call 'updateTasksName' with 'taskId' and the new name.`,
  suggestedTools: ['updateTasksName', 'searchEntities'],
}

export const UpdateTasksDescription: AgentSkill = {
  name: 'UpdateTasksDescription',
  description: 'Modify the description of an existing task.',
  rule: `*** RULE: UPDATING TASKS DESCRIPTION ***
    Goal: Modify the description of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. Call 'updateTasksDescription' with 'taskId' and the new description.`,
  suggestedTools: ['updateTasksDescription', 'searchEntities'],
}

export const UpdateTasksDueDate: AgentSkill = {
  name: 'UpdateTasksDueDate',
  description: 'Modify the due date of an existing task.',
  rule: `*** RULE: UPDATING TASKS DUE DATE ***
    Goal: Modify the due date of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. Call 'updateTasksDueDate' with 'taskId' and the new due date.`,
  suggestedTools: ['updateTasksDueDate', 'updateTasksDueTime', 'searchEntities'],
}

export const UpdateTasksDueTime: AgentSkill = {
  name: 'UpdateTasksDueTime',
  description: 'Modify the due time of an existing task.',
  rule: `*** RULE: UPDATING TASKS DUE TIME ***
    Goal: Modify the due time of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. Call 'updateTasksDueTime' with 'taskId' and the new due time.`,
  suggestedTools: ['updateTasksDueDate', 'updateTasksDueTime', 'searchEntities'],
}

export const UpdateTasksTags: AgentSkill = {
  name: 'UpdateTasksTags',
  description: 'Modify the tags of an existing task.',
  rule: `*** RULE: UPDATING TASKS TAGS ***
    Goal: Modify the tags of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. Call 'updateTasksTags' with 'taskId' and the new tags.`,
  suggestedTools: ['updateTasksTags', 'searchEntities'],
}

export const UpdateTasksColor: AgentSkill = {
  name: 'UpdateTasksColor',
  description: 'Modify the color of an existing task.',
  rule: `*** RULE: UPDATING TASKS COLOR ***
    Goal: Modify the color of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. If the user specifes a color tone (e.g., 'light', 'dark'), set it to the tone property.
    3. Call 'updateTasksColor' with 'taskId' and the new color.`,
  suggestedTools: ['updateTasksColor', 'searchEntities'],
}

export const UpdateTasksOrder: AgentSkill = {
  name: 'UpdateTasksOrder',
  description: 'Modify the order of an existing task.',
  rule: `*** RULE: EDITING TASKS ORDER ***
    Goal: Modify the order of an existing task.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'searchEntities'.
    2. Call 'updateTasksOrder' with 'taskId' and the new order.`,
  suggestedTools: ['updateTasksOrder', 'searchEntities'],
}

export const TaskLifecycle: AgentSkill = {
  name: 'TaskLifecycle',
  description: 'Change the existence state of a task (archive, recover, delete).',
  rule: `*** RULE: TASK LIFECYCLE (ARCHIVE / DELETE / RECOVER) ***
    Goal: Change the existence state of a Task.

    1. ARCHIVE (Soft Delete):
      - Action: User says "remove", "hide", "close", "archive".
      - Tool: 'archiveTasks'.
      - Logic: This is the PREFERRED default for removal.

    2. RECOVER (Restore):
      - Action: User says "restore", "bring back", "unarchive", "recover".
      - Tool: 'recoverTasks'.

    3. DELETE (Permanent):
      - Action: User explicitly says "destroy", "delete forever", "hard delete".
      - Tool: 'deleteTasks'.

    Procedure:
    1. Identify Task IDs using 'searchEntities' with isArchived flag or context.
    2. Call the appropriate tool with an ARRAY of IDs: {{ ids: ["..."] }}.`,
  suggestedTools: ['archiveTasks', 'recoverTasks', 'deleteTasks', 'searchEntities'],
}

export const SearchRelevantTasks: AgentSkill = {
  name: 'SearchRelevantTasks',
  description: 'Search and Retrieve tasks based on similarity search by names.',
  rule: `*** RULE: SEARCHING RELEVANT TASKS ***
    Goal: Search and Retrieve tasks based on similarity search by names.
    
    Procedure:
    1. Analyze the user request to extract task names to search.
    2. Call 'searchRelevantTasks' with the extracted task names.
     - If multiple tasks are found and the user request is ambiguous, use 'showEntitiesToUser' to present the options and ask for clarification.
     - If no tasks are found, DON'T LOOP, use 'responseToUser' to inform the user and ask for clarification or alternative input.
    3. Present results to the user using 'showEntitiesToUser' (if applicable).
    `,
  suggestedTools: ['searchRelevantTasks', 'showEntitiesToUser'],
}
