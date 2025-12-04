import { TaskService } from '@application/services/TaskService.ts'
import { tools } from '@application/ai/helpers/toolsHelper.ts'
import { toolsDescriptions } from '@application/ai/configs/toolsDescriptions.ts'
import { embeddingModel } from '@infrastructure/ai/initializeDependencies.ts'

export class ToolsManagerService {
  // 1. Метаданные (должны быть доступны LLM)
  public toolsByName: Record<string, any> = {}
  public functionSchemaMap: Map<string, any> = new Map()
  public functionTipMap: Map<string, { hasContent: boolean; tipToDisplay: string }> = new Map()

  // 2. Инжектированные зависимости (чистые сервисы)
  private taskService: TaskService

  constructor(taskService: TaskService) {
    this.taskService = taskService
    this._initializeTools() // Запускает инициализацию схем и эмбеддингов
  }

  private async _initializeTools() {
    const existingTools = await Tool.find()

    for (const tool of tools) {
      if (tool.schema) {
        this.functionSchemaMap.set(tool.name, tool.schema)

        switch (tool.name) {
          case 'createTasks':
            this.functionTipMap.set(tool.name, {
              hasContent: true,
              tipToDisplay: 'Создаю задачи...',
            })
            break
          case 'createCategories':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Создаю категории...',
            })
            break
          case 'createBoards':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Создаю доски...',
            })
            break
          case 'createWorkspaces':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Создаю пространства...',
            })
            break

          // --- Операции редактирования (Edit Operations) ---
          case 'editTasks':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Редактирую задачи...',
            })
            break
          case 'editCategories':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Редактирую категории...',
            })
            break
          case 'editBoards':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Редактирую доски...',
            })
            break
          case 'editWorkspaces':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Редактирую пространства...',
            })
            break

          // --- Операции поиска (Find Operations) ---
          case 'findRelevantTasks':
          case 'findTasksByFilter':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Ищу задачи...',
            })
            break
          case 'findRelevantCategories':
          case 'findCategoriesByFilter':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Ищу категории...',
            })
            break
          case 'findRelevantBoards':
          case 'findBoardsByFilter':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Ищу доски...',
            })
            break
          case 'findRelevantWorkspaces':
          case 'findWorkspacesByFilter':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Ищу пространства...',
            })
            break

          // --- Операции архивирования (Archive Operations) ---
          case 'archiveTasks':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Архивирую задачи...',
            })
            break
          case 'archiveCategories':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Архивирую категории...',
            })
            break
          case 'archiveBoards':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Архивирую доски...',
            })
            break
          case 'archiveWorkspaces':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Архивирую пространства...',
            })
            break

          // --- Операции восстановления (Recover Operations) ---
          case 'recoverTasks':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Восстанавливаю задачи...',
            })
            break
          case 'recoverCategories':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Восстанавливаю категории...',
            })
            break
          case 'recoverBoards':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Восстанавливаю доски...',
            })
            break
          case 'recoverWorkspaces':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Восстанавливаю пространства...',
            })
            break

          // --- Операции удаления (Delete Operations) ---
          case 'deleteTasks':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Удаляю задачи...',
            })
            break
          case 'deleteCategories':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Удаляю категории...',
            })
            break
          case 'deleteBoards':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Удаляю доски...',
            })
            break
          case 'deleteWorkspaces':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Удаляю пространства...',
            })
            break

          // --- Общие/Вспомогательные операции (General/Utility Operations) ---
          case 'getChatHistorySummary':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Получаю сводку истории чата...',
            })
            break
          case 'getChatHistory':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Получаю историю чата...',
            })
            break
          case 'getRelevantTools':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Ищу подходящие инструменты...',
            })
            break
          case 'undoOperations':
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Отменяю операции...',
            })
            break

          default:
            this.functionTipMap.set(tool.name, {
              hasContent: false,
              tipToDisplay: 'Выполняю действие...',
            })
            break
        }
      }

      const existingTool = existingTools.find((t) => t.name === tool.name)
      const description = (toolsDescriptions as any)[tool.name]

      if (existingTool && existingTool.description !== description) {
        const descriptionEmbedding = await embeddingModel.embedQuery(description)

        existingTool.embeddings = descriptionEmbedding
        existingTool.description = description

        existingTool.save()
      } else if (!existingTool) {
        const toolModel = new Tool()

        toolModel.name = tool.name
        toolModel.description = description
        toolModel.embeddings = await embeddingModel.embedQuery(description)

        toolModel.save()
      }
    }
  }
}
