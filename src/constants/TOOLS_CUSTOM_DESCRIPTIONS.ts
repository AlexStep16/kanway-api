export const TOOLS_CUSTOM_DESCRIPTIONS: Record<string, string> = {
  findCategoriesByFilter:
    'Search and retrieve a list of categories, columns, or lists based on strict technical filters such as board ID, type, or specific properties. Use this tool when you need to list all available columns on a board, inspect the board structure, or filter categories by specific metadata without relying on fuzzy name matching.',
  findRelevantCategories:
    "Find a specific category or column by its name or title. Use this tool when you need to resolve a category's unique ID based on a user-provided name (e.g., 'Find the Backlog column', 'Search for the Done list'). It is designed to locate the exact entity needed for subsequent operations like moving tasks or editing.",
  createCategories:
    'Create new categories, columns, vertical lists, or statuses on a board. Use this tool when the user wants to add a new stage to the workflow, insert a new list for tasks, or expand the board structure. It handles the creation of the category entity.',
  editCategories:
    "Update or modify the properties of existing categories. Use this tool to rename a column, change a list's color, update a description, or modify other attributes of a category. It is used for any non-destructive modification of a column's details.",
  archiveCategories:
    "Archive categories to hide them from the main board view without permanently losing data. Use this tool when the user wants to 'remove', 'hide', 'close', or 'retire' a column or list. This is a soft-delete action that allows for future restoration.",
  recoverCategories:
    'Restore previously archived categories or columns. Use this tool to bring back lists that were hidden, closed, or sent to the archive, making them active and visible on the board again. Useful for undoing an archive action.',
  deleteCategories:
    "Permanently delete categories or columns from the system. Use this tool ONLY when the user explicitly requests to 'destroy', 'delete forever', or remove data irreversibly. Unlike archiving, this action cannot be undone.",

  findBoardsByFilter:
    'Search and retrieve a list of boards or projects based on strict technical filters such as workspace ID, owner, or specific properties. Use this tool to list all available boards in a workspace, audit project metadata, or filter boards by system attributes without relying on fuzzy name matching.',
  findRelevantBoards:
    "Find a specific board or project by its name or title. Use this tool to resolve a board's unique ID based on a user-provided name (e.g., 'Find the Marketing board', 'Search for the Dev project'). It is essential for locating the correct target board before performing actions like moving tasks between boards or editing board settings.",
  createBoards:
    'Create new boards or projects. Use this tool when the user wants to start a new project, set up a new board for a team. It handles the creation of the board entity within a workspace.',
  editBoards:
    "Update or modify the properties of existing boards or projects. Use this tool to rename a board, change a project's description, update settings, or modify other attributes. It is used for non-destructive configuration changes to a board or project.",
  archiveBoards:
    "Archive boards or projects to hide them from the active list without permanently losing data. Use this tool when the user wants to 'close' a project, 'retire' a board, or 'remove' it temporarily. This is a soft-delete action that allows for future restoration.",
  recoverBoards:
    'Restore previously archived boards or projects. Use this tool to reopen closed projects, bring back hidden boards from the archive, or undo an archive action. It makes the board active and visible again.',
  deleteBoards:
    "Permanently delete boards or projects from the system. Use this tool ONLY when the user explicitly requests to 'destroy', 'delete forever', or remove a project irreversibly. This action cannot be undone and should be distinguished from archiving.",

  findWorkspacesByFilter:
    'Search and retrieve a list of workspaces, organizations, or team environments based on technical filters. Use this tool to list available workspaces for a user, audit organization data, or filter workspaces by specific system attributes.',
  findRelevantWorkspaces:
    "Find a specific workspace, organization, or team space by its name. Use this tool to resolve a workspace's unique ID based on a user-provided name (e.g., 'Find the Sales Team workspace', 'Search for My Company org'). Essential for switching contexts or targeting specific organizational units.",
  createWorkspaces:
    'Create new workspaces, organizations, or team environments. Use this tool when the user wants to set up a new isolated environment for a team, department, or company. It initializes a new workspace container.',
  editWorkspaces:
    'Update or modify the properties of existing workspaces or organizations. Use this tool to rename a workspace, update team settings, change descriptions, or modify other organizational attributes.',
  archiveWorkspaces:
    "Archive workspaces or organizations to deactivate them and hide them from active use without data loss. Use this tool to 'close' a team space or 'retire' an old organization. This is a soft-delete action allowing for future recovery.",
  recoverWorkspaces:
    'Restore previously archived workspaces or organizations. Use this tool to reactivate a closed team space or bring back a hidden workspace from the archive, making it fully functional again.',
  deleteWorkspaces:
    'Permanently delete workspaces, organizations, or team environments. Use this tool ONLY for irreversible destruction of an entire workspace and all its contents. Use with extreme caution as this cannot be undone.',

  findTasksByFilter:
    'Search and retrieve a list of tasks, tickets, issues, or todos based on specific criteria such as status, priority, assignee, tags, or due dates. Use this tool to filter the backlog, find tasks assigned to a specific user, list high-priority bugs, or query tasks by their technical attributes.',
  findRelevantTasks:
    "Find a specific task, ticket, or issue by its title or name. Use this tool to resolve a task's unique ID based on a user-provided description (e.g., 'Find the login bug', 'Search for the design task'). It is essential for locating the exact work item needed for operations like editing, moving, or assigning.",
  createTasks:
    'Create new tasks, tickets, bugs, issues, or todos. Use this tool when the user wants to add a new work item to the board, log a defect, create a reminder, or start a new assignment. It handles the creation of the task entity.',
  editTasks:
    "Update or modify the properties of existing tasks. Use this tool to change a task's status (move it), reassign it to a user, update the due date, rename the title, change priority, or modify the description. It is used for any non-destructive change to a task's details.",
  archiveTasks:
    "Archive tasks to remove them from the active board view without permanently deleting them. Use this tool when the user wants to 'close' a ticket, 'hide' completed items, or 'remove' tasks temporarily to clean up the board. This is a soft-delete action.",
  recoverTasks:
    'Restore previously archived tasks, tickets, or issues. Use this tool to bring back closed items, unhide tasks from the archive, or undo an archive action, making them active and visible on the board again.',
  deleteTasks:
    "Permanently delete tasks, tickets, or issues from the system. Use this tool ONLY when the user explicitly requests to 'destroy', 'delete forever', or remove a task irreversibly. This action cannot be undone and is distinct from archiving.",
}
