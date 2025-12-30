import { TaskService } from '@application/services/TaskService.ts'
import { BaseService } from '@application/services/BaseService.ts'
import {
  TaskFilterDTO,
  TaskFilterSchema,
  TaskCreateDTO,
  TaskCreateSchema,
  EditTasksDTO,
  EditTasksSchema,
} from './toolSchemes.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from './FailedToolResult.ts'
import { SuccessToolResult } from './SuccessToolResult.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { TaskDTO } from '@/application/dtos/TaskDTO.ts'
import { Types } from 'mongoose'
import { IUser } from '@/domain/entities/IUser.ts'
import { TaskCommandAdapterService } from '@/application/ai/services/TaskCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.ts'
import { IUndoResponse } from '@/application/interfaces/IUndoResponse.ts'
import { ITasksResponse } from '@/application/interfaces/ITasksResponse.ts'
import { ITask } from '@/domain/entities/ITask.ts'
import dayjs from 'dayjs'
import * as Sentry from '@sentry/node'

interface CompressedTask {
  id: string
  name: string
  categoryName?: string
  description?: string
  isCompleted: boolean
  dueDate?: string
}

export class TaskToolAdapter {
  private baseService: BaseService
  private taskService: TaskService
  private taskCommandAdapterService: TaskCommandAdapterService
  private categoryService: CategoryService
  private filterToMongoQueryService: FilterToMongoQueryService

  constructor(
    baseService: BaseService,
    taskService: TaskService,
    taskCommandAdapterService: TaskCommandAdapterService,
    categoryService: CategoryService,
    filterToMongoQueryService: FilterToMongoQueryService
  ) {
    this.baseService = baseService
    this.taskService = taskService
    this.taskCommandAdapterService = taskCommandAdapterService
    this.categoryService = categoryService
    this.filterToMongoQueryService = filterToMongoQueryService
  }

  private _convertDateToTimezone(task: Partial<ITask>, timezone: string) {
    const collectedDateTime =
      task.dueDate +
      'T' +
      task.dueHours?.toString().padStart(2, '0') +
      ':' +
      task.dueMinutes?.toString().padStart(2, '0')

    const date = dayjs.utc(collectedDateTime).tz(timezone)

    return date
  }

  private _getChangedColumns(changes: EditTasksDTO['changes']): string[] {
    const changedColumns: string[] = []

    const changesMap: Record<keyof EditTasksDTO['changes'], keyof ITask | Array<keyof ITask>> = {
      name: 'name',
      description: 'description',
      dueDate: 'dueDate',
      dueTime: ['dueHours', 'dueMinutes'],
      tags: 'tags',
      categoryId: 'categoryId',
      isCompleted: 'isCompleted',
      color: 'color',
      order: 'order',
    }

    for (const key in changes) {
      const mappedKey = changesMap[key as keyof EditTasksDTO['changes']]

      if (Array.isArray(mappedKey)) {
        changedColumns.push(...mappedKey)
      } else {
        changedColumns.push(mappedKey)
      }
    }

    return changedColumns
  }

  private _compressTasks(tasks: ITask[]): Array<CompressedTask> {
    return tasks.map((task) => ({
      id: task.id.toString(),
      name: task.name,
      categoryName: task.categoryName,
      description: task.description ? task.description.slice(0, 100) : '',
      isCompleted: task.isCompleted,
      dueDate: task.dueDate,
    }))
  }

  // [Tool 1]
  public async findTasksByFilter(
    dto: TaskFilterDTO,
    config: LangGraphRunnableConfig
  ): Promise<string> {
    const user = config.configurable?.user as IUser
    const timezone = config.configurable?.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = this.baseService.validateInputBySchema(dto, TaskFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(dto, timezone, user.id)

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

      const compressedTasks = this._compressTasks(tasks)

      if (compressedTasks.length === 0) {
        return 'No tasks found matching the provided filter.'
      } else if (compressedTasks.length > 20) {
        return `Found ${compressedTasks.length} tasks. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedTasks)
    } catch (e) {
      Sentry.captureException(e)

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

      const userId = config.configurable?.user?.id

      const tasks = await this.baseService.similaritySearchTasks(nameToFind, userId, 30)

      const compressedTasks = this._compressTasks(tasks)

      if (compressedTasks.length === 0) {
        return 'No tasks found matching the provided filter.'
      } else if (compressedTasks.length > 20) {
        return `Found ${compressedTasks.length} tasks. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedTasks)
    } catch (e) {
      Sentry.captureException(e)

      return `Error finding relevant tasks: ${(e as Error).message}`
    }
  }

  public async createTasks(
    dto: TaskCreateDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.thread_id as string | undefined

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
        config.configurable?.timezone || 'Europe/Moscow',
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

      const createResult = await this.taskService.createMany(extendedTasks, user)

      if (!createResult) {
        return new FailedToolResult('Tasks creation failed.')
      }

      if (createResult.data && createResult.data.length === 0) {
        return new FailedToolResult('No tasks were created.')
      } else if (!createResult.data) {
        return new FailedToolResult('Tasks creation failed.')
      }

      const integration: IUndoResponse<ITasksResponse> = {
        create: {
          tasks: createResult.data,
        },
      }

      const dataWithIntegration = {
        data: createResult.data.map((task) => ({ id: task.id, name: task.name })),
        logId: createResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating tasks: ${(e as Error).message}`)
    }
  }

  public async editTasks(dto: EditTasksDTO, config: LangGraphRunnableConfig): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const threadId = config.configurable?.thread_id as string | undefined
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

      const integration: IUndoResponse<ITasksResponse> = {
        update: {
          tasks: editResult.data,
        },
      }

      // Get only changed columns to return
      const changedColumns = this._getChangedColumns(dto.changes)

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = { id: task.id, name: task.name }

        for (const column of changedColumns) {
          taskWithChangedColumns[column as keyof ITask] = (task as any)[column]
        }

        if (
          taskWithChangedColumns.dueHours !== undefined ||
          taskWithChangedColumns.dueMinutes !== undefined
        ) {
          const date = this._convertDateToTimezone(task, timezone)

          taskWithChangedColumns.dueDate = date.format('YYYY-MM-DD')
          taskWithChangedColumns.dueHours = date.hour()
          taskWithChangedColumns.dueMinutes = date.minute()
        }

        return taskWithChangedColumns
      })

      const dataWithIntegration = {
        data: dataWithChangedColumns,
        logId: editResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error editing tasks: ${(e as Error).message}`)
    }
  }

  public async archiveTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for archiving.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while archiving tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const archiveResult = await this.taskService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Tasks archiving failed.')
      }

      if (archiveResult.data && archiveResult.data.tasks && archiveResult.data.tasks.length === 0) {
        return new FailedToolResult('No tasks were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Tasks archiving failed.')
      }

      const integration: IUndoResponse<ITasksResponse> = {
        update: {
          tasks: archiveResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        data: archiveResult.data.tasks.map((task) => task.id),
        logId: archiveResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving tasks: ${(e as Error).message}`)
    }
  }

  public async deleteTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for deletion.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while deleting tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const deleteResult = await this.taskService.delete({ ids }, user)

      if (!deleteResult) {
        return new FailedToolResult('Tasks deletion failed.')
      }

      const deletedIds: unknown = ids.map((id) => ({ id }))

      const integration: IUndoResponse<ITasksResponse> = {
        update: {
          tasks: deleteResult,
        },
        delete: {
          tasks: deletedIds as ITask[],
        },
      }

      const dataWithIntegration = {
        data: deleteResult.map((task) => task.id),
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting tasks: ${(e as Error).message}`)
    }
  }

  public async recoverTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const user = config.configurable?.user as IUser
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for recovering.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while recovering tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const recoverResult = await this.taskService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Tasks recovering failed.')
      }

      if (recoverResult.data && recoverResult.data.tasks && recoverResult.data.tasks.length === 0) {
        return new FailedToolResult('No tasks were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Tasks recovering failed.')
      }

      const integration: IUndoResponse<ITasksResponse> = {
        update: {
          tasks: recoverResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        data: recoverResult.data.tasks.map((task) => task.id),
        logId: recoverResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering tasks: ${(e as Error).message}`)
    }
  }

  private async _extendTaskCreateDTOWithContext(
    tasks: TaskCreateDTO['tasks'],
    errors: string[],
    userId: Types.ObjectId,
    timezone: string,
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
        color: closestColor,
        categoryName: category.name,
        boardId: category.boardId.toString(),
        boardName: category.boardName,
        workspaceId: category.workspaceId.toString(),
        workspaceName: category.workspaceName,
      }

      if (task.dueDate) {
        if (task.dueTime) {
          const collectedDateTime = task.dueDate + 'T' + task.dueTime
          const date = dayjs.tz(dayjs(collectedDateTime), timezone).utc()

          taskExtended.dueDate = date.format('YYYY-MM-DD')
          taskExtended.dueHours = date.hour()
          taskExtended.dueMinutes = date.minute()

          delete (taskExtended as any).dueTime // Remove dueTime as it's now split into hours and minutes
        }
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
