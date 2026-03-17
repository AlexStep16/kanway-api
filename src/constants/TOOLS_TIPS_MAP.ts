export const TOOLS_TIPS_MAP = new Map<string, string>([
  ['createTasks', 'Создаю задачи'],
  ['createCategories', 'Создаю категории'],
  ['createBoards', 'Создаю доски'],
  ['createWorkspaces', 'Создаю пространства'],

  // --- Операции редактирования (Edit Operations) ---
  ['updateTasksName', 'Редактирую названия задач'],
  ['updateCategoriesName', 'Редактирую названия категорий'],
  ['updateBoardsName', 'Редактирую названия досок'],
  ['updateWorkspacesName', 'Редактирую названия пространств'],

  ['updateTasksDescription', 'Редактирую описания задач'],
  ['updateTasksDueDate', 'Редактирую дедлайны задач'],
  ['updateTasksDueTime', 'Редактирую время задач'],
  ['updateTasksTags', 'Редактирую теги задач'],
  ['updateTasksColor', 'Редактирую цвет задач'],
  ['completeTasks', 'Изменяю статус выполнения задач'],

  ['updateTasksOrder', 'Изменяю порядок задач'],
  ['updateCategoriesOrder', 'Изменяю порядок категорий'],
  ['updateBoardsOrder', 'Изменяю порядок досок'],
  ['updateWorkspacesOrder', 'Изменяю порядок пространств'],

  ['moveTasks', 'Перемещаю задачи'],
  ['moveCategories', 'Перемещаю категории'],
  ['moveBoards', 'Перемещаю доски'],
  ['moveWorkspaces', 'Перемещаю пространства'],

  ['updateWorkspacesColor', 'Редактирую цвет пространств'],

  ['favoriteBoards', 'Изменяю статус избранного у досок'],
  ['favoriteWorkspaces', 'Изменяю статус избранного у пространств'],

  // --- Операции поиска (Find Operations) ---
  ['searchRelevantTasks', 'Ищу задачи'],
  ['searchRelevantCategories', 'Ищу категории'],
  ['searchRelevantBoards', 'Ищу доски'],
  ['searchRelevantWorkspaces', 'Ищу пространства'],
  ['searchEntities', 'Выполняю поиск'],

  // --- Операции архивирования (Archive Operations) ---
  ['archiveTasks', 'Архивирую задачи'],
  ['archiveCategories', 'Архивирую категории'],
  ['archiveBoards', 'Архивирую доски'],
  ['archiveWorkspaces', 'Архивирую пространства'],

  // --- Операции восстановления (Recover Operations) ---
  ['recoverTasks', 'Восстанавливаю задачи'],
  ['recoverCategories', 'Восстанавливаю категории'],
  ['recoverBoards', 'Восстанавливаю доски'],
  ['recoverWorkspaces', 'Восстанавливаю пространства'],

  // --- Операции удаления (Delete Operations) ---
  ['deleteTasks', 'Удаляю задачи'],
  ['deleteCategories', 'Удаляю категории'],
  ['deleteBoards', 'Удаляю доски'],
  ['deleteWorkspaces', 'Удаляю пространства'],

  // --- Общие/Вспомогательные операции (General/Utility Operations) ---
  ['getRelevantTools', 'Ищу подходящие инструменты'],
  ['undoOperations', 'Отменяю операции'],
])
