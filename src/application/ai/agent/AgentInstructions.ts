import { AgentInstruction } from '../interfaces/AgentInstruction.ts'

export const AgentInstructions: AgentInstruction[] = [
  {
    topic: 'Move Tasks',
    examples: [
      'Перенеси задачу в другую колонку',
      'Перенеси задачу в категорию в работе',
      'Задачу сделать отчет в бэклог',
      'Перемести задачу в категорию',
      'Найди другое место для задачи',
      'Измени категорию задачи на',
      'Поменяй колонку задачи на',
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
      'Перенеси категорию на другую доску',
      'Перенеси категорию на доску в работе',
      'Категорию сделать отчет в личное',
      'Move category to another board',
      'Перемести категорию на доску',
      'Найди другое место для категории',
      'Измени доску категории на',
      'Поменяй доску категории на',
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
      'Перенеси доску в другое пространство',
      'Перенеси доску в проект Работа',
      'Доску сделать отчет в личное',
      'Move board to another workspace',
      'Перемести доску в пространство',
      'Найди другое место для доски',
      'Измени пространство доски на',
      'Поменяй пространство доски на',
    ],
    rule: `*** RULE: MOVING BOARDS ***
    1. Find the target 'workspaceId' using 'findWorkspacesByFilter'.
    2. Use 'editBoards' with the found 'workspaceId'.

    NEVER create or delete boards for moving. ALWAYS use 'editBoards'.
    `,
    suggestedTools: ['editBoards', 'findBoardsByFilter', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Create Tasks',
    examples: [
      'Создай задачу в категорию',
      'Добавь задачу в колонку',
      'Create task in category',
      'Запланируй',
      'Новая задача',
      'Добавь задачу',
      'Создай таск для колонки',
      'Сделай карточку',
      'Создай карточку',
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
      'Создай категорию "Архив"',
      'Добавь колонку "На проверке"',
      'Сделай новый список "Ideas"',
      'Создай столбец "Done" на доске Маркетинг',
      'Добавь колонку "В работе"',
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
      'Создай доску "Маркетинг"',
      'Сделай борд "Личное"',
      'Добавь новую доску',
      'Create board "Development"',
      'Новая доска',
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
      'Создай воркспейс "Моя Компания"',
      'Новое рабочее пространство "Team Alpha"',
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
      'Обнови задачу с новыми деталями',
      'Измени задачу на новое описание',
      'Редактируй задачу',
      'Обнови таск',
      'Измени детали задачи',
      'Поменяй дату задачи',
      'Измени цвет задачи',
      'Убери описание у задачи',
      'Добавь новый цвет для задачи',
      'Обнови приоритет задачи',
      'Сделай задачу срочной',
      'Пометь задачу как важную',
      'Отметь задачу как выполненную',
      'Добавь тег к задаче',
      'Убери теги у задачи',
      'Убери статус у задачи',
      'Сними отметку с задачи',
      'Поставь новый статус задаче',
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
      'Обнови категорию с новыми деталями',
      'Измени категорию на новое описание',
      'Редактируй категорию',
      'Обнови категорию',
      'Измени детали категории',
      'Поменяй дату категории',
      'Измени цвет категории',
      'Убери описание у категории',
      'Добавь новый цвет для категории',
      'Обнови приоритет категории',
      'Сделай категорию срочной',
      'Пометь категорию как важную',
      'Отметь категорию как выполненную',
      'Добавь тег к категории',
      'Убери теги у категории',
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
      'Обнови доску с новыми деталями',
      'Измени доску на новое описание',
      'Редактируй доску',
      'Обнови доску',
      'Измени детали доски',
      'Поменяй дату доски',
      'Измени цвет доски',
      'Убери описание у доски',
      'Добавь новый цвет для доски',
      'Обнови приоритет доски',
      'Сделай доску срочной',
      'Пометь доску как важную',
      'Отметь доску как выполненную',
      'Добавь доску в избранное',
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
      'Обнови пространство с новыми деталями',
      'Измени пространство на новое описание',
      'Редактируй пространство',
      'Обнови пространство',
      'Измени детали пространства',
      'Поменяй дату пространства',
      'Измени цвет пространства',
      'Убери описание у пространства',
      'Добавь новый цвет для пространства',
      'Обнови приоритет пространства',
      'Сделай пространство срочным',
      'Пометь пространство как важное',
      'Отметь пространство как выполненное',
      'Добавь пространство в избранное',
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
    topic: 'Delete Tasks',
    examples: [
      'Удалить задачу',
      'Убери задачу',
      'Избавься от задачи',
      'Навсегда удали задачу',
      'Delete task',
      'Remove task',
    ],
    rule: `*** RULE: DELETING TASKS ***
    Goal: Delete an existing tasks.
    
    Procedure:
    1. Identify the target Task ID explicitly via 'findTasksByFilter' or context.
    2. Prefer 'archiveTasks' unless the user explicitly says "delete", "remove forever", or "destroy".
    3. If permanent deletion is requested, call 'deleteTasks' with 'taskId'.
    
    Note: Don't ask user for confirmation. Assume they understand the consequences of permanent deletion.`,
    suggestedTools: ['deleteTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Delete Categories',
    examples: [
      'Удалить категорию',
      'Убери категорию',
      'Избавься от категории',
      'Навсегда удали категорию',
      'Delete category',
      'Remove category',
    ],
    rule: `*** RULE: DELETING CATEGORIES ***
    Goal: Delete an existing categories.
    
    Procedure:
    1. Identify the target Category ID explicitly via 'findCategoriesByFilter' or context.
    2. Prefer 'archiveCategories' unless the user explicitly says "delete", "remove forever", or "destroy".
    3. If permanent deletion is requested, call 'deleteCategories' with 'categoryId'.
    
    Note: Don't ask user for confirmation. Assume they understand the consequences of permanent deletion.`,
    suggestedTools: ['deleteCategories', 'findCategoriesByFilter'],
  },
  {
    topic: 'Delete Boards',
    examples: [
      'Удалить доску',
      'Убери доску',
      'Избавься от доски',
      'Навсегда удали доску',
      'Delete board',
      'Remove board',
    ],
    rule: `*** RULE: DELETING BOARDS ***
    Goal: Delete an existing boards.
    
    Procedure:
    1. Identify the target Board ID explicitly via 'findBoardsByFilter' or context.
    2. Prefer 'archiveBoards' unless the user explicitly says "delete", "remove forever", or "destroy".
    3. If permanent deletion is requested, call 'deleteBoards' with 'boardId'.
    
    Note: Don't ask user for confirmation. Assume they understand the consequences of permanent deletion.`,
    suggestedTools: ['deleteBoards', 'findBoardsByFilter'],
  },
  {
    topic: 'Delete Workspaces',
    examples: [
      'Удалить пространство',
      'Убери пространство',
      'Избавься от пространства',
      'Навсегда удали пространство',
      'Delete workspace',
      'Remove workspace',
    ],
    rule: `*** RULE: DELETING WORKSPACES ***
    Goal: Delete an existing workspaces.
    
    Procedure:
    1. Identify the target Workspace ID explicitly via 'findWorkspacesByFilter' or context.
    2. Prefer 'archiveWorkspaces' unless the user explicitly says "delete", "remove forever", or "destroy".
    3. If permanent deletion is requested, call 'deleteWorkspaces' with 'workspaceId'.
    
    Note: Don't ask user for confirmation. Assume they understand the consequences of permanent deletion.`,
    suggestedTools: ['deleteWorkspaces', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Archive tasks',
    examples: [
      'Архивируй задачу',
      'Помести задачу в архив',
      'Спрячь задачу',
      'Добавь задачу в корзину',
      'Законсервируй задачу',
      'Archive task',
    ],
    rule: `*** RULE: ARCHIVING TASKS ***
    Goal: Move an active task to the Archive (soft delete).
    
    Procedure:
    1. Identify the target Task ID. Use 'findTasksByFilter' to resolve the ID.
    2. Call 'archiveTasks' with the resolved 'taskId'.

    Constraint: This action usually hides the task from the main list but preserves data.`,
    suggestedTools: ['archiveTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Archive categories',
    examples: [
      'Архивируй категорию',
      'Помести категорию в архив',
      'Спрячь категорию',
      'Добавь категорию в корзину',
      'Законсервируй категорию',
      'Archive category',
    ],
    rule: `*** RULE: ARCHIVING CATEGORIES ***
    Goal: Move an active category to the Archive (soft delete).
    
    Procedure:
    1. Identify the target Category ID. Use 'findCategoriesByFilter' to resolve the ID.
    2. Call 'archiveCategories' with the resolved 'categoryId'.

    Constraint: This action usually hides the category from the main list but preserves data.`,
    suggestedTools: ['archiveCategories', 'findCategoriesByFilter'],
  },
  {
    topic: 'Archive boards',
    examples: [
      'Архивируй доску',
      'Помести доску в архив',
      'Спрячь доску',
      'Добавь доску в корзину',
      'Законсервируй доску',
      'Archive board',
    ],
    rule: `*** RULE: ARCHIVING BOARDS ***
    Goal: Move an active board to the Archive (soft delete).
    
    Procedure:
    1. Identify the target Board ID.
      - If the user says "this board" or "current board", use the active context ID.
      - If the user gives a name, use 'findBoardsByFilter' to resolve the ID.

    2. Call 'archiveBoards' with the resolved 'boardId'.

    Constraint: This action usually hides the board from the main list but preserves data.`,
    suggestedTools: ['archiveBoards', 'findBoardsByFilter'],
  },
  {
    topic: 'Archive workspaces',
    examples: [
      'Архивируй пространство',
      'Помести пространство в архив',
      'Спрячь пространство',
      'Добавь пространство в корзину',
      'Законсервируй пространство',
      'Archive workspace',
    ],
    rule: `*** RULE: ARCHIVING WORKSPACES ***
    Goal: Move an active workspace to the Archive (soft delete).
    
    Procedure:
    1. Identify the target Workspace ID.
      - If the user says "this workspace" or "current space", use the active context ID.
      - If the user gives a name, use 'findWorkspacesByFilter' to resolve the ID.

    2. Call 'archiveWorkspaces' with the resolved 'workspaceId'.

    Constraint: This action usually hides the workspace from the main list but preserves data.`,
    suggestedTools: ['archiveWorkspaces', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Recover tasks',
    examples: [
      'Восстанови задачу из архива',
      'Верни задачу из корзины',
      'Разархивируй задачу',
      'Восстанови задачу',
      'Recover task',
    ],
    rule: `*** RULE: RECOVERING TASKS ***
    Goal: Recover an archived tasks.
    
    Procedure:
    1. Identify the target Task.
      - If the user provides a name, use 'findTasksByFilter' to search.
      - IMPORTANT: When searching, ensure you are searching for ARCHIVED tasks (if the filter tool supports an 'isArchived' or 'status' flag). Otherwise, you might not find it.

    2. Once the 'taskId' is found, call 'recoverTasks' with that ID.

    Note: You cannot recover a task that has been permanently deleted, only archived ones.`,
    suggestedTools: ['recoverTasks', 'findTasksByFilter'],
  },
  {
    topic: 'Recover categories',
    examples: [
      'Восстанови категорию из архива',
      'Верни категорию из корзины',
      'Разархивируй категорию',
      'Восстанови категорию',
      'Recover category',
    ],
    rule: `*** RULE: RECOVERING CATEGORIES ***
    Goal: Recover an archived categories.
    
    Procedure:
    1. Identify the target Category.
      - If the user provides a name, use 'findCategoriesByFilter' to search.
      - IMPORTANT: When searching, ensure you are searching for ARCHIVED categories (if the filter tool supports an 'isArchived' or 'status' flag). Otherwise, you might not find it.

    2. Once the 'categoryId' is found, call 'recoverCategories' with that ID.

    Note: You cannot recover a category that has been permanently deleted, only archived ones.`,
    suggestedTools: ['recoverCategories', 'findCategoriesByFilter'],
  },
  {
    topic: 'Recover boards',
    examples: [
      'Восстанови доску из архива',
      'Верни доску из корзины',
      'Разархивируй доску',
      'Восстанови доску',
      'Recover board',
    ],
    rule: `*** RULE: RECOVERING BOARDS ***
    Goal: Recover an archived boards.
    
    Procedure:
    1. Identify the target Board.
      - If the user provides a name, use 'findBoardsByFilter' to search.
      - IMPORTANT: When searching, ensure you are searching for ARCHIVED boards (if the filter tool supports an 'isArchived' or 'status' flag). Otherwise, you might not find it.

    2. Once the 'boardId' is found, call 'recoverBoards' with that ID.

    Note: You cannot recover a board that has been permanently deleted, only archived ones.`,
    suggestedTools: ['recoverBoards', 'findBoardsByFilter'],
  },
  {
    topic: 'Recover workspaces',
    examples: [
      'Восстанови пространство из архива',
      'Верни пространство из корзины',
      'Разархивируй пространство',
      'Восстанови пространство',
      'Recover workspace',
    ],
    rule: `*** RULE: RECOVERING WORKSPACES ***
    Goal: Recover an archived workspaces.
    
    Procedure:
    1. Identify the target Workspace.
      - If the user provides a name, use 'findWorkspacesByFilter' to search.
      - IMPORTANT: When searching, ensure you are searching for ARCHIVED workspaces (if the filter tool supports an 'isArchived' or 'status' flag). Otherwise, you might not find it.

    2. Once the 'workspaceId' is found, call 'recoverWorkspaces' with that ID.

    Note: You cannot recover a workspace that has been permanently deleted, only archived ones.`,
    suggestedTools: ['recoverWorkspaces', 'findWorkspacesByFilter'],
  },
  {
    topic: 'Find tasks',
    examples: [
      'Найди задачу по имени',
      'Покажи задачу с таким названием',
      'Ищи задачу',
      'Все задачи на сегодня с цветом',
      'Выбери задачи с тегом',
      'Найди задачи начинающиеся на',
      'Find task by name',
      'Найди задачи у которых есть описание',
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
    4. [OPTIONAL] Present results to the user using 'showEntitiesToUser'.

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
      'Найди категорию по имени',
      'Покажи категорию с таким названием',
      'Ищи категорию',
      'Все категории на сегодня с цветом',
      'Выбери категории с тегом',
      'Найди категории начинающиеся на',
      'Find category by name',
      'Найди категории у которых есть описание',
      'Покажи категории с дедлайном завтра',
      'Ищи категории в категории',
      'Все категории в колонке',
      'Давай покажи все категории на доске',
      'Сколько у меня категорий в пространстве',
      'Сколько у меня категорий в категории',
      'На кого назначена категория',
    ],
    rule: `*** RULE: FINDING (READING) CATEGORIES ***
    Goal: Search and Retrieve categories based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Map human concepts to filter fields:
      - "In Personal" -> first find boardId with findBoardsByFilter for 'Personal', then filter categories by 'boardId'.
    3. Call 'findCategoriesByFilter' with the constructed filter object.
    4. [OPTIONAL] Present results to the user using 'showEntitiesToUser'.

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
      'Найди доску по имени',
      'Покажи доску с таким названием',
      'Ищи доску',
      'Все доски на сегодня с цветом',
      'Выбери доски с тегом',
      'Найди доски начинающиеся на',
      'Find board by name',
      'Найди доски у которых есть описание',
      'Покажи доски с дедлайном завтра',
      'Ищи доски в категории',
      'Все доски в колонке',
      'Давай покажи все доски на доске',
      'Сколько у меня досок в пространстве',
      'Сколько у меня досок в категории',
      'На кого назначена доска',
    ],
    rule: `*** RULE: FINDING (READING) BOARDS ***
    Goal: Search and Retrieve boards based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Map human concepts to filter fields:
      - "In Personal" -> first find workspaceId with findWorkspacesByFilter for 'Personal', then filter boards by 'workspaceId'.
    3. Call 'findBoardsByFilter' with the constructed filter object.
    4. [OPTIONAL] Present results to the user using 'showEntitiesToUser'.

    Advanced Logic (AND/OR):
    - If user says "A OR B", use the 'OR' array field in the filter tool if supported.
    - Default behavior is usually AND (all conditions must match).
    `,
    suggestedTools: ['findBoardsByFilter', 'findWorkspacesByFilter', 'showEntitiesToUser'],
  },
  {
    topic: 'Find Workspaces',
    examples: [
      'Найди пространство по имени',
      'Покажи пространство с таким названием',
      'Ищи пространство',
      'Все пространства на сегодня с цветом',
      'Выбери пространства с тегом',
      'Найди пространства начинающиеся на',
      'Find workspace by name',
      'Найди пространства у которых есть описание',
      'Покажи пространства с дедлайном завтра',
      'Ищи пространства в категории',
      'Все пространства в колонке',
      'Давай покажи все пространства на пространстве',
      'Сколько у меня пространств в пространстве',
      'Сколько у меня пространств в категории',
      'На кого назначено пространство',
    ],
    rule: `*** RULE: FINDING (READING) WORKSPACES ***
    Goal: Search and Retrieve workspaces based on filters.
    
    Procedure:
    1. Analyze the user request to extract search criteria.
    2. Call 'findWorkspacesByFilter' with the constructed filter object.
    3. [OPTIONAL] Present results to the user using 'showEntitiesToUser'.

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
