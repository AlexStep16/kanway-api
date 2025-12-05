import { TaskService } from '@application/services/TaskService.ts'
import { BaseToolAdapter } from '@application/ai/tools/BaseToolAdapter.ts'
import { BaseService } from '@application/services/BaseService.ts'
import {
  ConditionalTaskFilterDTO,
  ConditionalTaskFilterSchema,
  TaskCreateDTO,
  TaskCreateSchema,
  EditTasksDTO,
  EditTasksSchema,
} from './toolSchemes.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { filterToMongoQuery } from '@infrastructure/ai/filterToMongoQuery.ts'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from './FailedToolResult.ts'
import { SuccessToolResult } from './SuccessToolResult.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { TaskDTO } from '@/application/dtos/TaskDTO.ts'
import { Types } from 'mongoose'
import { IUser } from '@/domain/entities/IUser.ts'
import { TaskCommandAdapterService } from '@application/services/TaskCommandAdapterService.ts'

export class TaskToolAdapter extends BaseToolAdapter {
  private taskService: TaskService
  private taskCommandAdapterService: TaskCommandAdapterService
  private categoryService: CategoryService

  constructor(
    baseService: BaseService,
    taskService: TaskService,
    taskCommandAdapterService: TaskCommandAdapterService,
    categoryService: CategoryService
  ) {
    super(baseService)

    this.taskService = taskService
    this.taskCommandAdapterService = taskCommandAdapterService
    this.categoryService = categoryService
  }

  // [Tool 1]
  public async findTasksByFilter(
    dto: ConditionalTaskFilterDTO,
    config: LangGraphRunnableConfig
  ): Promise<string> {
    const user = config.configurable?.user as IUser
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

      const tasks = await this.taskService.getByFilter(mongoFilter, user.id, 30)

      if (tasks.length === 0) {
        const taskName = getFilterNameField(mongoFilter)

        if (taskName) {
          // If no tasks found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.baseService.similaritySearchTasks(
            taskName,
            user.id,
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
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.threadId as string | undefined

    try {
      const tasks = dto.tasks

      if (!tasks || tasks.length === 0) {
        return new FailedToolResult('No tasks provided for creation.')
      }

      const errors: string[] = []

      const extendedTasks = await this._extendTaskCreateDTOWithContext(
        tasks,
        errors,
        user.id,
        threadId
      )

      const validationSchemaMessages = this.baseService.validateInputBySchema(dto, TaskCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Tasks schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const tasksResult = await this.taskService.createMany(extendedTasks, user)

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

  public async editTasks(dto: EditTasksDTO, config: LangGraphRunnableConfig): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.threadId as string | undefined
    const timezone = config.configurable?.timezone || 'Europe/Moscow'

    try {
      const categoryIdValidationMessage = dto.changes.categoryId
        ? await this._validateCategoryId(dto.changes.categoryId, user.id)
        : ''

      if (categoryIdValidationMessage) {
        return new FailedToolResult(categoryIdValidationMessage)
      }

      const errors: string[] = []

      const validationSchemaMessages = this.baseService.validateInputBySchema(dto, EditTasksSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const editResult = await this.taskCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        timezone,
        user,
        undefined,
        threadId
      )

      return new SuccessToolResult(editResult)
    } catch (e) {
      return new FailedToolResult(`Error editing tasks: ${(e as Error).message}`)
    }
  }

  private async _extendTaskCreateDTOWithContext(
    tasks: TaskCreateDTO['tasks'],
    errors: string[],
    userId: Types.ObjectId,
    threadId?: string
  ): Promise<TaskDTO[]> {
    const extendedTasks: TaskDTO[] = []

    for (const task of tasks) {
      const category = await this.categoryService.getById(task.categoryId, userId)

      if (!category) {
        errors.push(`Category with ID ${task.categoryId} not found.`)

        continue
      }

      const closestColor = task.color ? this.taskService.getNearestColor(task.color) : undefined

      const taskExtended: TaskDTO = {
        ...task,
        color: closestColor ? closestColor : undefined,
        categoryName: category.name,
        boardId: category.boardId.toString(),
        boardName: category.boardName,
        workspaceId: category.workspaceId.toString(),
        workspaceName: category.workspaceName,
      }

      if (threadId) {
        taskExtended.threadId = threadId
      }

      extendedTasks.push(taskExtended)
    }

    return extendedTasks
  }

  private async _validateCategoryId(categoryId: string, userId: Types.ObjectId): Promise<string> {
    const category = await this.categoryService.getById(categoryId, userId)

    if (!category) {
      return `Category with ID ${categoryId} not found.`
    }

    return ''
  }
}
