import { AgentSkill } from '@/application/ai/interfaces/AgentSkill.ts'

export const TasksReadSkill: AgentSkill = {
  name: 'TasksRead',
  description:
    'Skill for reading and understanding tasks. Use this skill to extract key information from tasks, such as objectives, requirements, and constraints.',
  content: `
    ### SKILL: TasksRead

    This skill allows you to find tasks using either strict criteria, fuzzy text search, or both.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - **Hybrid Search:** If the user says "Find my urgent bug tasks about login", use BOTH arguments:
      - 'mongo_filter={"tags": "urgent"}' (Strict)
      - 'search_query="login bug"' (Fuzzy)
    - **Pure Fuzzy:** If the user says "Search for 'project alpha'", use ONLY 'search_query="project alpha"'.
    - **Pure Strict:** If the user says "Show all done tasks", use ONLY 'mongo_filter={"is_completed": True}'.
  `,
  relatedTools: ['search_tasks', 'display_to_user'],
  relatedEntities: ['task'],
}

export const TasksCreateSkill: AgentSkill = {
  name: 'TasksCreate',
  description: 'Skill for creating tasks. Use this skill to add new tasks.',
  content: `
    ### SKILL: TasksCreate

    This skill allows you to create new tasks. You must resolve Workspace, Board and Category names to IDs before creation.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Board Resolution: Next, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board_id to a variable.
    - Category Resolution: Next, in the same script, query for the category. Handle ambiguity the same way.
    - If the user provided a category name but it doesn't exist, create it using create_categories before creating the task.
    - Creation: Finally, use the resolved variables to call create_tasks at the end of the script.
  `,
  relatedTools: [
    'create_tasks',
    'create_categories',
    'search_workspaces',
    'search_boards',
    'search_categories',
    'resolve_ambiguous',
  ],
  relatedEntities: ['task', 'category', 'board', 'workspace'],
}

export const TasksUpdateSkill: AgentSkill = {
  name: 'TasksUpdate',
  description: 'Skill for updating tasks. Use this skill to modify existing tasks.',
  content: `
    ### SKILL: TasksUpdate

    This skill allows you to update existing tasks. You must resolve Workspace, Board, Category and Task names to IDs before updating.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Workspace Resolution: First, query for the workspace. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the workspace_id to a variable.
    - Board Resolution: Next, query for the board. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the board_id to a variable.
    - Category Resolution: Next, in the same script, query for the category. Handle ambiguity the same way.
    - Task Resolution: Next, in the same script, query for the task. Handle ambiguity the same way.
    - Update: Finally, use the resolved variables to call update_tasks at the end of the script.
  `,
  relatedTools: [
    'update_tasks',
    'search_tasks',
    'search_workspaces',
    'search_boards',
    'search_categories',
    'resolve_ambiguous',
  ],
  relatedEntities: ['task', 'category', 'board', 'workspace'],
}

export const TaskMoveSkill: AgentSkill = {
  name: 'TaskMove',
  description: 'Skill for moving task. Use this skill to change the position of existing task.',
  content: `
    ### SKILL: TaskMove

    This skill allows you to move existing task. You must resolve Task name to ID before moving and determine the new position based on user input. Before and after task IDs are optional.
    If the user says "Move task A to the start of the category", then find the first task in the category by sorting by rank and use its ID as beforeTaskId, leaving afterTaskId null.
    By default task will be moved to the bottom of the category.

    ### SCRIPT LOGIC (MUST BE IN A SINGLE SCRIPT):
    - When generating your code, structure it as follows:
    - Task Resolution: First, query for the task. If the result is ambiguous (len > 1), call resolve_ambiguous. If not, save the task_id to a variable.
    - Next, in the same script, determine the new position of the task by identifying the beforeTaskId and afterTaskId. If the user says "Move task A before task B", then beforeTaskId is the ID of task B and afterTaskId is null. If the user says "Move task A after task C", then afterTaskId is the ID of task C and beforeTaskId is null. If the user says "Move task A between task B and task C", then beforeTaskId is the ID of task B and afterTaskId is the ID of task C.
    - If the user says "Move task A to category D", resolve category D by 'search_categories' to get newCategoryId.
    - Move the task using the resolved variables to call move_task at the end of the script.
  `,
  relatedTools: ['move_task', 'search_tasks', 'search_categories', 'resolve_ambiguous'],
  relatedEntities: ['task', 'category'],
}
