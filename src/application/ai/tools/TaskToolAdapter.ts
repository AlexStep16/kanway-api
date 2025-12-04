import { TaskService } from '@application/services/TaskService.ts'
import { BaseToolAdapter } from '@application/ai/tools/BaseToolAdapter.ts'
import { BaseService } from '@application/services/BaseService.ts'
import {
  ConditionalTaskFilterDTO,
  ConditionalTaskFilterSchema,
  TaskCreateDTO,
  TaskCreateSchema,
} from './toolSchemes.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { filterToMongoQuery } from '@infrastructure/ai/filterToMongoQuery.ts'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from './FailedToolResult.ts'
import { SuccessToolResult } from './SuccessToolResult.ts'

export class TaskToolAdapter extends BaseToolAdapter {
  private taskService: TaskService

  constructor(baseService: BaseService, taskService: TaskService) {
    super(baseService)
    this.taskService = taskService
  }

  // [Tool 1]
  public async findTasksByFilter(
    dto: ConditionalTaskFilterDTO,
    config: LangGraphRunnableConfig
  ): Promise<string> {
    const userId = config.configurable?.userId
    const timezone = config.configurable?.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = this.baseService.validateInputBySchema(dto, ConditionalTaskFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await filterToMongoQuery(dto, timezone, 'task')

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const tasks = await this.taskService.getByFilter(mongoFilter, userId, 30)

      if (tasks.length === 0) {
        const taskName = getFilterNameField(mongoFilter)

        if (taskName) {
          // If no tasks found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.baseService.similaritySearchTasks(
            taskName,
            userId,
            2
          )

          if (semanticSearchResults.length === 0) {
            return `No tasks found matching the filter or semantically similar to the name "${taskName}".`
          }

          return (
            `No exact matches found. Here are some tasks that might be relevant based on the name "${taskName}":\n` +
            JSON.stringify(semanticSearchResults)
          )
        }
      }

      return JSON.stringify(tasks)
    } catch (e) {
      return `Error retrieving tasks: ${(e as Error).message}`
    }
  }

  public async findRelevantTasks(
    findRelevantDto: { nameToFind: string },
    config: LangGraphRunnableConfig
  ): Promise<string> {
    try {
      const { nameToFind } = findRelevantDto

      if (!nameToFind) {
        return 'Task name required to find relevant tasks.'
      }

      const userId = config.configurable?.userId

      const tasks = await this.baseService.similaritySearchTasks(nameToFind, userId, 20)

      return JSON.stringify(
        tasks.map((task) => ({
          id: task.id.toString(),
          name: task.name,
        }))
      )
    } catch (e) {
      return `Error finding relevant tasks: ${(e as Error).message}`
    }
  }

  public async createTask(
    dto: TaskCreateDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const userId = config.configurable?.userId
    const threadId = config.configurable?.threadId

    try {
      const tasks = dto.tasks

      if (!tasks || tasks.length === 0) {
        return new FailedToolResult('No tasks provided for creation.')
      }

      const errorMsgs = this.baseService.validateInputBySchema(tasks, TaskCreateSchema)

      if (errorMsgs.length > 0) {
        return new FailedToolResult(
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      const tasksResult = await this.taskService.createMany(tasks, userId)

      if (!tasksResult) {
        return new FailedToolResult('Tasks creation failed.')
      }

      if (tasksResult.data && tasksResult.data.length === 0) {
        return new FailedToolResult('No tasks were created.')
      } else if (!tasksResult.data) {
        return new FailedToolResult('Tasks creation failed.')
      }

      return new SuccessToolResult(tasksResult)
    } catch (e) {
      return new FailedToolResult(`Error creating tasks: ${(e as Error).message}`)
    }
  }
}
