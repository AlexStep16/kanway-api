import { AgentInstruction } from '../interfaces/AgentInstruction.ts'

export const AgentInstructions: AgentInstruction[] = [
  {
    topic: 'Task Completion',
    examples: [
      'Заверши задачу',
      'Отметь задачу как выполненную',
      'Сделай задачу сделанной',
      'Поставь галочку на задаче',
      'Сними отметку выполнения',
      'Верни задачу в работу',
      'Перенеси задачу в сделанные',
      'Поменяй статус на выполнено',
      'Выполни задачу',

      'Mark task as completed',
      'Set task status to done',
      'Unmark task as completed',
      'Change task status to not completed',
      'Update task completion status',
      'Move task to completed state',
    ],
    rule: `*** RULE: TASK COMPLETION ***
    Goal: Change the completion status of a task (Done / Not Done).

    Mapping:
    - "Complete", "Mark as done", "Move to done" -> Set 'isCompleted' to true.
    - "Uncomplete", "Reopen", "Move to todo" -> Set 'isCompleted' to false.

    Procedure:
    1. Identify the task ID.
    2. Call 'editTasks' to update the isCompleted field.
    `,
    suggestedTools: ['editTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Move Tasks',
    examples: [
      "Move task 'X' to category 'Y'",
      "Move task to column 'Done'",
      "Change task category to 'In Progress'",
      "Set task 'X' category to 'Backlog'",
      "Transfer task to board 'Marketing'",
      'Move task to another board',

      'Перенеси задачу в другую колонку',
      'Перемести задачу в категорию в работе',
      'Закинь задачу в бэклог',
      "Поменяй статус задачи на 'Выполнено'",
      'Перенеси задачу на доску Маркетинг',
      'Измени колонку задачи',
    ],
    rule: `*** RULE: MOVING TASKS ***
    User wants to move a task. It could be to another column OR another board.

    Procedure:
    1. Extract the destination context (e.g., "to column 'Done'", "to board 'Marketing'").
    2. Determine if the destination is a COLUMN or a BOARD.
      - Look for keywords like "column", "category", "list", "board".
      - If ambiguous ("move it here"), try to resolve context first.

    If Destination is a COLUMN (on the current board):
    1. Find the target 'categoryId' using 'findCategoriesByFilter'.
    2. Use 'editTasks' with the found 'categoryId'.

    If Destination is a BOARD:
    1. Find the target BOARD ID using 'findBoardsByFilter' by name.
    2. Find a suitable 'categoryId' ON THE TARGET BOARD using 'findCategoriesByFilter' (filter by target boardId).
    3. Use 'editTasks' with the resolved 'categoryId'.

    NEVER create or delete tasks for moving. ALWAYS use 'editTasks'.
    `,
    suggestedTools: [
      'editTasks',
      'findTasksByFilter',
      'findCategoriesByFilter',
      'findBoardsByFilter',
    ],
  },
  {
    topic: 'Move Categories',
    examples: [
      "Move category 'X' to board 'Y'",
      'Move column to another board',
      'Change category board',
      "Relocate list to project 'Marketing'",
      "Transfer column to workspace 'Alpha'",

      'Перенеси категорию на другую доску',
      'Перемести колонку в проект Дизайн',
      'Перекинь столбец на другой борд',
      'Закинь категорию в другой воркспейс',
    ],
    rule: `*** RULE: MOVING CATEGORIES ***
    User wants to move a category. It could be to another board OR another workspace.

    Procedure:
    1. Extract the destination context (e.g., "to board 'Done'", "to workspace 'Marketing'").
    2. Determine if the destination is a BOARD or a WORKSPACE.
      - Look for keywords like "board", "workspace", "project".
      - If ambiguous ("move it here"), try to resolve context first.

    If Destination is a BOARD (on the current workspace):
    1. Find the target 'boardId' using 'findBoardsByFilter'.
    2. Use 'editCategories' with the found 'boardId'.

    If Destination is a WORKSPACE:
    1. Find the target WORKSPACE ID using 'findWorkspacesByFilter' by name.
    2. Find a suitable 'boardId' ON THE TARGET WORKSPACE using 'findBoardsByFilter' (filter by target workspaceId).
    3. Use 'editCategories' with the resolved 'boardId'.

    NEVER create or delete categories for moving. ALWAYS use 'editCategories'.
    `,
    suggestedTools: [
      'editCategories',
      'findCategoriesByFilter',
      'findBoardsByFilter',
      'findWorkspacesByFilter',
    ],
  },
  {
    topic: 'Move Boards',
    examples: [
      "Move board 'Project X' to workspace 'Team Y'",
      "Change board's parent workspace",
      'Transfer project to another workspace',
      "Set board 'Alpha's workspace to 'Marketing'",
      'Relocate board',

      'Перенеси эту доску в другое рабочее пространство',
      "Перемести проект в воркспейс 'Продажи'",
      "Эта доска должна быть в пространстве 'Дизайн'",
      'Смени воркспейс для этой доски',
    ],
    rule: `*** RULE: MOVING BOARDS ***
    1. Find the target 'workspaceId' using 'findWorkspacesByFilter'.
    2. Use 'editBoards' with the found 'workspaceId'.

    NEVER create or delete boards for moving. ALWAYS use 'editBoards'.
    `,
    suggestedTools: ['editBoards', 'findBoardsByFilter', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Clone Tasks',
    examples: [
      "Clone task 'Buy milk'",
      "Clone task 'New feature'",
      "Clone task 'выполнить план'",
      "Clone task 'удалить старые файлы'",
      "Clone task 'перенести данные'",
      "Clone task 'закрыть сделку'",
      "Clone task 'Fix login bug'",
      "Duplicate tasks 'X' and 'Y'",
      "Duplicate task 'X'",

      "Скопируй задачу 'Проверить отчет'",
      "Скопируй баг 'Кнопка не работает'",
      'Сделай клонирование задачи в колонку Готово',
      'Клонируй задачу',
      'Сделай копию такой же задачи',
      'Повтори задачу',
      'Продублируй задачи',
    ],
    rule: `*** RULE: CLONING TASKS ***
    Goal: Create a duplicate of an existing task.

    RULES:
    1. Identify the task ID(s) to be cloned.
    2. Call 'cloneTasks' with the identified ID(s).
    3. If the user mentions any changes to the cloned task (e.g., different name, category), use 'editTasks' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneTasks' with the identified ID(s).
    `,
    suggestedTools: ['cloneTasks', 'editTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Clone Categories',
    examples: [
      "Clone category 'Done'",
      "Clone category 'New'",
      "Clone category 'Backlog'",
      "Clone category 'Plan'",
      "Duplicate categories 'X' and 'Y'",
      "Duplicate category 'X'",

      "Скопируй категорию 'Готово'",
      "Скопируй колонку 'Баги'",
      'Сделай клонирование категории в доску Готово',
      'Клонируй категорию',
      'Сделай копию такой же категории',
      'Повтори категорию',
      'Продублируй категории',
    ],
    rule: `*** RULE: CLONING CATEGORIES ***
    Goal: Create a duplicate of an existing category.

    RULES:
    1. Identify the category ID(s) to be cloned.
    2. Call 'cloneCategories' with the identified ID(s).
    3. If the user mentions any changes to the cloned category (e.g., different name, board), use 'editCategories' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneCategories' with the identified ID(s).
    `,
    suggestedTools: ['cloneCategories', 'editCategories', 'findCategoriesByFilter'],
  },
  {
    topic: 'Clone Boards',
    examples: [
      "Clone board 'Personal'",
      "Clone board 'Sport'",
      "Clone board 'Fitness'",
      "Clone board 'Plan'",
      "Duplicate boards 'X' and 'Y'",
      "Duplicate board 'X'",

      "Скопируй доску 'Готово'",
      "Скопируй доску 'Баги'",
      'Сделай клонирование доски в пространство Моё',
      'Клонируй доску',
      'Сделай копию такой же доски',
      'Повтори доску',
      'Продублируй доски',
    ],
    rule: `*** RULE: CLONING BOARDS ***
    Goal: Create a duplicate of an existing board.

    RULES:
    1. Identify the board ID(s) to be cloned.
    2. Call 'cloneBoards' with the identified ID(s).
    3. If the user mentions any changes to the cloned board (e.g., different name, workspace), use 'editBoards' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneBoards' with the identified ID(s).
    `,
    suggestedTools: ['cloneBoards', 'editBoards', 'findBoardsByFilter'],
  },
  {
    topic: 'Clone Workspaces',
    examples: [
      "Clone workspace 'Personal'",
      "Clone workspace 'Sport'",
      "Clone workspace 'Fitness'",
      "Clone workspace 'Plan'",
      "Duplicate workspaces 'X' and 'Y'",
      "Duplicate workspace 'X'",

      "Скопируй пространство 'Готово'",
      "Скопируй пространство 'Баги'",
      'Клонируй пространство',
      'Сделай копию такого же пространства',
      'Повтори пространство',
      'Продублируй пространства',
    ],
    rule: `*** RULE: CLONING WORKSPACES ***
    Goal: Create a duplicate of an existing workspace.

    RULES:
    1. Identify the workspace ID(s) to be cloned.
    2. Call 'cloneWorkspaces' with the identified ID(s).
    3. If the user mentions any changes to the cloned workspace (e.g., different name), use 'editWorkspaces' after cloning to apply those changes.

    EXECUTION:
    - Call 'cloneWorkspaces' with the identified ID(s).
    `,
    suggestedTools: ['cloneWorkspaces', 'editWorkspaces', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Create Tasks',
    examples: [
      "Create task 'Buy milk'",
      "Create task 'New feature'",
      "Create task 'выполнить план'",
      "Create task 'удалить старые файлы'",
      "Create task 'перенести данные'",
      "Create task 'закрыть сделку'",
      "Create task 'Fix login bug'",

      "Add new task 'Buy milk'",
      "Create ticket in 'Backlog' column",
      "Add issue to 'Bugs' category",
      "Create task 'Meeting' on board 'Marketing'",
      "New task for user 'John'",

      "Создай задачу 'Проверить отчет'",
      "Запиши баг 'Кнопка не работает'",
      'Новая задача в колонку Готово',
      'Добавь тикет на доску Разработка',
      "Сделай таск 'Позвонить клиенту'",
      'Создай задачу для Пети',
    ],
    rule: `*** RULE: CREATING TASKS ***
    Goal: Create a new task. You must decide the best Category (Column) based on user input.

    PRIORITY 1: EXPLICIT CATEGORY
    IF the user explicitly names a category (e.g., "in Done", "to Backlog"):
      1. Call 'findCategoriesByFilter' with the 'name' filter to find that specific category ID.
      2. If found, use that 'categoryId'.
      3. If NOT found, fallback to PRIORITY 2.

    PRIORITY 2: SEMANTIC MATCHING (Smart Placement)
    IF NO category is named (or named category not found):
      1. Call 'findCategoriesByFilter' (with boardId filter) to get ALL columns on the current board.
      2. ANALYZE meanings:
        - Task implies a bug/fix? -> Look for 'Bugs', 'Issues'.
        - Task implies an idea? -> Look for 'Ideas', 'Backlog'.
        - Task implies active work? -> Look for 'In Progress'.
        - Otherwise -> Look for 'Inbox', 'To Do', or 'Backlog'.
      3. Select the best matching 'categoryId'.

    EXECUTION:
    - Call 'createTasks' with 'name', selected 'categoryId' and other fields(if needed).
    `,
    suggestedTools: [
      'createTasks',
      'findCategoriesByFilter',
      'findBoardsByFilter',
      'findWorkspacesByFilter',
    ],
  },
  {
    topic: 'Create Categories',
    examples: [
      "Create category 'Done'",
      "Create category 'выполнить план'",
      "Create category 'удалить старые файлы'",
      "Create category 'перенести данные'",
      "Create category 'закрыть сделку'",
      "Create category 'Fix login bug'",

      "Add new column 'Review'",
      "Create list 'Backlog' on board 'Dev'",
      'Add status column',

      "Создай категорию 'Архив'",
      "Добавь колонку 'На проверке'",
      'Сделай новый список',
      "Создай столбец 'Done' на доске Маркетинг",
    ],
    rule: `*** RULE: CREATING CATEGORIES (COLUMNS) ***
    Goal: Create a new vertical categories/lists on a board.

    Procedure:
    1. Extract the category 'name' from user input.

    2. IDENTIFY TARGET BOARD:
      a. IF a Board is explicitly named (e.g., "on Marketing board"):
        - Call 'findBoardsByFilter' (by name) to resolve the target 'boardId'.
        - Use this 'boardId'.
      b. IF NO Board is named:
        - The system assumes the CURRENT board. DO NOT search for board ID manually unless you need to confirm existence.

    3. EXECUTION:
      - Call 'createCategories' with the 'name', target 'boardId' and other fields(if needed).
      - Note: New categories are usually appended to the end of the board by default.
    `,
    suggestedTools: ['createCategories', 'findBoardsByFilter', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Create Boards',
    examples: [
      "Create board 'Project Alpha'",
      "Create board 'выполнить план'",
      "Create board 'удалить старые файлы'",
      "Create board 'перенести данные'",
      "Create board 'закрыть сделку'",
      "Create board 'Fix login bug'",

      "Add new project 'Website Redesign'",
      "Create space 'Personal'",
      'Initialize new board',

      "Создай доску 'Маркетинг'",
      "Новый проект 'Запуск сайта'",
      "Сделай борд 'Личное'",
      'Создай доску',
    ],
    rule: `*** RULE: CREATING BOARDS ***
    Goal: Create a new Boards.

    Procedure:
    1. Extract the board 'name' from user input.
    2. If NO name is provided (e.g., just "Create a board"), ask the user for a name OR create with a default name like "New Board".
    3. CHECK WORKSPACE:
      a. IF a Workspace is explicitly named (e.g., "on Marketing workspace"):
        - Call 'findWorkspacesByFilter' (by name) to resolve the target 'workspaceId'.
        - Use this 'workspaceId'.
      b. IF NO Workspace is named:
        - The system assumes the CURRENT workspace. DO NOT search for workspace ID manually unless you need to confirm existence.

    EXECUTION:
    - Call 'createBoards' with the extracted 'name' and founded 'workspaceId'.
  `,

    suggestedTools: ['createBoards', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Create Workspaces',
    examples: [
      "Create workspace 'My Company'",
      "Create workspace 'выполнить план'",
      "Create workspace 'удалить старые файлы'",
      "Create workspace 'перенести данные'",
      "Create workspace 'закрыть сделку'",
      "Create workspace 'Fix login bug'",

      "Add organization 'Sales Team'",
      'Initialize new workspace',

      "Создай воркспейс 'Моя Компания'",
      "Новое рабочее пространство 'Team Alpha'",
      'Сделай спейс для отдела продаж',
      'Создай пространство',
    ],
    rule: `*** RULE: CREATING WORKSPACES ***
    Goal: Create a new Workspaces (Organization/Team Space).

    Procedure:
    1. Extract the workspace 'name' from user input.
    2. If NO name is provided, generate a sensible default (e.g. "My Workspace") or ask the user.

    EXECUTION:
    - Call 'createWorkspaces' with the extracted 'name'.
    
    Note: Creating a workspace usually creates a clean slate. The user might need to create boards inside it afterwards.`,

    suggestedTools: ['createWorkspaces'],
  },
  {
    topic: 'Edit Tasks',
    examples: [
      "Update task 'X' details",
      'Change task description',
      'Set task priority to high',
      'Mark task as complete',
      'Remove task due date',
      'Clear task tags',
      'Edit task color',
      'Uncheck task',
      'Set task status to active',

      // --- Natural User Language (Russian) ---
      'Обнови задачу с новыми деталями',
      'Измени задачу на новое описание',
      'Редактируй задачу',
      'Поменяй дату задачи',
      'Измени цвет задачи',
      'Убери описание у задачи',
      'Сделай задачу срочной',
      'Пометь задачу как важную',
      'Отметь задачу как выполненную',
      'Добавь тег к задаче',
      'Убери теги у задачи',
      'Убери статус у задачи',
      'Сними отметку с задачи',
      'Удали дату у задачи',
    ],
    rule: `*** RULE: EDITING TASKS ***
    Goal: Modify properties of an existing tasks.

    Field Mapping Guidelines:
    - "Urgent" / "Important" -> Set 'color' to '#ff6467' or '#e7000b'.
    - "Completed" / "Done" -> Set 'isCompleted': true.
    - "Date" / "Deadline" -> Update 'dueDate'.
    - "Time" / "Deadline" -> Update 'dueTime'.
    
    Procedure:
    1. If 'taskId' is not clear from context, search for the tasks using 'findTasksByFilter'.
    2. Call 'editTasks' with 'taskId' and the specific fields to change.`,
    suggestedTools: ['editTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Edit Categories',
    examples: [
      "Rename category 'X' to 'Y'",
      'Update column color',
      'Change category description',
      "Set category type to 'Done'",
      'Edit list details',
      'Clear category color',
      'Update category properties',

      'Обнови категорию с новыми деталями',
      'Переименуй категорию',
      'Измени название колонки',
      'Редактируй категорию',
      'Измени цвет категории',
      'Убери описание у категории',
      'Поставь новый цвет для списка',
      'Сделай категорию завершающей',
      'Отметь колонку как выполненную',
    ],
    rule: `*** RULE: EDITING CATEGORIES ***
    Goal: Modify properties of an existing categories.
    
    Procedure:
    1. If 'categoryId' is not clear from context, search for the categories using 'findCategoriesByFilter'.
    2. Call 'editCategories' with 'categoryId' and the specific fields to change.`,
    suggestedTools: ['editCategories', 'findCategoriesByFilter'],
  },
  {
    topic: 'Edit Boards',
    examples: [
      "Rename board 'X'",
      'Update project description',
      'Change board background color',
      'Mark board as favorite',
      'Pin this board',
      'Unpin board',
      'Edit board details',

      'Обнови доску с новыми деталями',
      'Переименуй проект',
      'Редактируй доску',
      'Измени описание доски',
      'Поменяй цвет доски',
      'Убери описание у доски',
      'Добавь доску в избранное',
      'Закрепи проект',
      'Убери из избранного',
    ],
    rule: `*** RULE: EDITING BOARDS ***
    Goal: Modify properties of an existing boards.

    Field Mapping Guidelines:
    - "Favorite" / "Starred" -> Set 'isFavorite' to true.
    
    Procedure:
    1. If 'boardId' is not clear from context, search for the boards using 'findBoardsByFilter'.
    2. Call 'editBoards' with 'boardId' and the specific fields to change.`,
    suggestedTools: ['editBoards', 'findBoardsByFilter'],
  },
  {
    topic: 'Edit Workspaces',
    examples: [
      "Rename workspace 'X'",
      'Update organization details',
      'Change workspace description',
      'Edit team space name',

      'Обнови пространство',
      'Переименуй воркспейс',
      'Измени название организации',
      'Редактируй пространство',
      'Измени детали пространства',
      'Убери описание у воркспейса',
    ],
    rule: `*** RULE: EDITING WORKSPACES ***
    Goal: Modify properties of an existing workspaces.

    Field Mapping Guidelines:
    - "Favorite" / "Starred" -> Set 'isFavorite' to true.
    
    Procedure:
    1. If 'workspaceId' is not clear from context, search for the workspaces using 'findWorkspacesByFilter'.
    2. Call 'editWorkspaces' with 'workspaceId' and the specific fields to change.`,
    suggestedTools: ['editWorkspaces', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Task Lifecycle',
    examples: [
      // --- Planner / Technical ---
      "Archive task 'X'",
      'Delete task permanently',
      'Recover ticket from archive',
      'Remove issue',
      'Permanently destroy task',
      'Soft delete task',
      'Unarchive task',
      'Reopen task',
      'Restore task',

      // --- Natural Language ---
      'Удали задачу',
      'Снеси тикет',
      'Открой задачу',
      'Закрой задачу',
      'Восстанови задачу',
      'Снеси задачу',
      'Мягко удали задачу',
      'Жестко удали задачу',
      'Архивируй задачу',
      'Восстанови задачу из архива',
      'Верни таск обратно',
      'Убери эту задачу',
    ],
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
    1. Identify Task IDs using 'findTasksByFilter' with isArchived flag or context.
    2. Call the appropriate tool with an ARRAY of IDs: {{ ids: ["..."] }}.`,
    suggestedTools: ['archiveTasks', 'recoverTasks', 'deleteTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Category Lifecycle',
    examples: [
      // --- Planner / Technical ---
      "Restore category 'X'",
      "Archive category 'Done'",
      "Delete column 'X'",
      "Recover list 'Backlog'",
      'Permanently remove category',
      'Destroy column',
      'Open category from archive',
      'Remove status column',

      // --- Natural Language ---
      'Удали категорию',
      'Снеси колонку',
      'Открой категорию',
      'Закрой категорию',
      'Архивируй список',
      'Восстанови колонку',
      'Верни категорию из архива',
    ],
    rule: `*** RULE: CATEGORY LIFECYCLE (ARCHIVE / DELETE / RECOVER) ***
    Goal: Change the existence state of a Category (Column).

    1. ARCHIVE (Soft Delete):
      - Tool: 'archiveCategories'.
      - Use for "remove", "hide", "archive".

    2. RECOVER (Restore):
      - Tool: 'recoverCategories'.

    3. DELETE (Permanent):
      - Tool: 'deleteCategories'.
      - WARNING: Deleting a category usually deletes/archives all tasks inside it.

    Procedure:
    1. Identify Category IDs using 'findCategoriesByFilter' with isArchived flag or context.
    2. Call tool with {{ ids: ["..."] }}.`,
    suggestedTools: [
      'archiveCategories',
      'recoverCategories',
      'deleteCategories',
      'findCategoriesByFilter',
    ],
  },
  {
    topic: 'Board Lifecycle',
    examples: [
      // --- Planner / Technical ---
      "Archive board 'Project X'",
      "Restore board 'Project X'",
      'Delete project',
      'Remove board permanently',
      'Open board',
      'Recover board from trash',
      'Close board',

      // --- Natural Language ---
      'Удали доску',
      'Снеси проект',
      'Открой доску',
      'Архивируй проект',
      'Закрой доску',
      'Восстанови доску',
      'Верни проект из корзины',
    ],
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
    1. Identify Board IDs using 'findBoardsByFilter' with isArchived flag or context.
    2. Call tool with {{ ids: ["..."] }}.`,
    suggestedTools: ['archiveBoards', 'recoverBoards', 'deleteBoards', 'findBoardsByFilter'],
  },
  {
    topic: 'Workspace Lifecycle',
    examples: [
      // --- Planner / Technical ---
      "Archive workspace 'Team A'",
      "Restore workspace 'Team A'",
      "Reopen organization 'My Company'",
      'Delete organization',
      'Recover workspace',

      // --- Natural Language ---
      'Удали пространство',
      'Архивируй воркспейс',
      'Закрой организацию',
      'Закрой воркспейс',
      'Открой пространство',
      'Удали организацию',
      'Восстанови пространство',
      'Верни воркспейс',
    ],
    rule: `*** RULE: WORKSPACE LIFECYCLE ***
    Goal: Manage Workspace existence.

    1. ARCHIVE: 'archiveWorkspaces'.
    2. RECOVER: 'recoverWorkspaces'.
    3. DELETE: 'deleteWorkspaces'.

    Procedure:
    1. Identify Workspace IDs using 'findWorkspacesByFilter' with isArchived flag or context.
    2. Call tool with {{ ids: ["..."] }}.`,
    suggestedTools: [
      'archiveWorkspaces',
      'recoverWorkspaces',
      'deleteWorkspaces',
      'findWorkspacesByFilter',
    ],
  },
  {
    topic: 'Find tasks',
    examples: [
      "Find task by title 'X'",
      "List tasks in category 'Done'",
      "Search tasks assigned to 'User'",
      'Get tasks with due date today',
      "Filter tasks by priority 'High'",
      'Find all tasks on board',
      "Show tasks with tag 'Bug'",

      'Найди задачу по имени',
      'Покажи задачу с таким названием',
      'Ищи задачу',
      'Все задачи на сегодня с цветом',
      'Выбери задачи с тегом',
      'Найди задачи начинающиеся на',
      'Покажи задачи с дедлайном завтра',
      'Ищи задачи в категории',
      'Все задачи в колонке',
      'Давай покажи все задачи на доске',
      'Сколько у меня задач в пространстве',
      'Сколько у меня задач в категории',
      'На кого назначена задача',
    ],
    rule: `*** RULE: FINDING (READING) TASKS ***
    Goal: Search and Retrieve tasks based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria (e.g. "deadline tomorrow", "assigned to me", "in Backlog").
    2. Map human concepts to filter fields:
      - "Tomorrow" -> calculate date for 'dueDate'.
      - "In Backlog" -> first find categoryId with findCategoriesByFilter for 'Backlog', then filter tasks by 'categoryId'.
    3. Call 'findTasksByFilter' with the constructed filter object.
    4. Present results to the user using 'showEntitiesToUser'.

    Advanced Logic (AND/OR):
    - If user says "A OR B" (e.g. "High priority OR Urgent"), use the 'OR' array field in the filter tool if supported.
    - Default behavior is usually AND (all conditions must match).
    `,
    suggestedTools: [
      'findTasksByFilter',
      'findCategoriesByFilter',
      'findBoardsByFilter',
      'showEntitiesToUser',
    ],
  },
  {
    topic: 'Find Categories',
    examples: [
      'List all categories on board',
      "Find category by name 'Done'",
      "Get columns for board 'X'",
      'Search categories in workspace',
      'Show board structure',
      "Check if category 'Backlog' exists",

      'Найди категорию по имени',
      'Покажи список колонок',
      'Какие категории есть на доске',
      'Есть ли колонка Done?',
      "Найди список с названием 'Бэклог'",
      'Покажи структуру доски',
      'Выведи все столбцы',
    ],
    rule: `*** RULE: FINDING (READING) CATEGORIES ***
    Goal: Search and Retrieve categories based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Map human concepts to filter fields:
      - "In Personal" -> first find boardId with findBoardsByFilter for 'Personal', then filter categories by 'boardId'.
    3. Call 'findCategoriesByFilter' with the constructed filter object.
    4. Present results to the user using 'showEntitiesToUser'.

    Advanced Logic (AND/OR):
    - If user says "A OR B", use the 'OR' array field in the filter tool if supported.
    - Default behavior is usually AND (all conditions must match).
    `,
    suggestedTools: [
      'findCategoriesByFilter',
      'findBoardsByFilter',
      'findWorkspacesByFilter',
      'showEntitiesToUser',
    ],
  },
  {
    topic: 'Find Boards',
    examples: [
      'List all boards',
      "Find board by name 'Alpha'",
      'Search projects in workspace',
      'Get boards created by me',
      'Show available boards',

      'Найди доску по имени',
      'Покажи все мои проекты',
      'Список досок',
      "Есть ли доска 'Маркетинг'?",
      'Покажи проекты в этом пространстве',
      'Какие доски мне доступны',
    ],
    rule: `*** RULE: FINDING (READING) BOARDS ***
    Goal: Search and Retrieve boards based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Map human concepts to filter fields:
      - "In Personal" -> first find workspaceId with findWorkspacesByFilter for 'Personal', then filter boards by 'workspaceId'.
    3. Call 'findBoardsByFilter' with the constructed filter object.
    4. Present results to the user using 'showEntitiesToUser'.

    Advanced Logic (AND/OR):
    - If user says "A OR B", use the 'OR' array field in the filter tool if supported.
    - Default behavior is usually AND (all conditions must match).
    `,
    suggestedTools: ['findBoardsByFilter', 'findWorkspacesByFilter', 'showEntitiesToUser'],
  },
  {
    topic: 'Find Workspaces',
    examples: [
      'List all workspaces',
      "Find workspace 'Company A'",
      'Search organizations',
      'Show my teams',

      'Найди пространство по имени',
      'Покажи все воркспейсы',
      'Список организаций',
      'В каких я командах',
      "Есть ли спейс 'Продажи'?",
    ],
    rule: `*** RULE: FINDING (READING) WORKSPACES ***
    Goal: Search and Retrieve workspaces based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Call 'findWorkspacesByFilter' with the constructed filter object.
    3. Present results to the user using 'showEntitiesToUser'.

    Advanced Logic (AND/OR):
    - If user says "A OR B", use the 'OR' array field in the filter tool if supported.
    - Default behavior is usually AND (all conditions must match).
    `,
    suggestedTools: ['findWorkspacesByFilter', 'showEntitiesToUser'],
  },
  {
    topic: 'Undo Operations',
    examples: [
      'Отмени последнее действие',
      'Верни назад последнее изменение',
      'Отмени изменения',
      'Верни назад',
      'Undo last action',
    ],
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
  },
]
