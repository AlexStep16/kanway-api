import { TaskService } from '@application/services/TaskService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
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
import { TaskCommandAdapterService } from '@/application/ai/services/TaskCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@/application/ai/services/FilterToMongoQueryService.ts'
import { ITask } from '@/domain/entities/ITask.ts'
import dayjs from 'dayjs'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import { validateInputBySchema } from '@/utils/validateInputBySchema.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'

interface CompressedTask {
  id: string
  name: string
  categoryName?: string
  description?: string
  isCompleted: boolean
  dueDate?: string
}

export class TaskToolAdapter {
  private vectorSearchService: VectorSearchService
  private taskService: TaskService
  private taskCommandAdapterService: TaskCommandAdapterService
  private categoryService: CategoryService
  private filterToMongoQueryService: FilterToMongoQueryService

  constructor(
    vectorSearchService: VectorSearchService,
    taskService: TaskService,
    taskCommandAdapterService: TaskCommandAdapterService,
    categoryService: CategoryService,
    filterToMongoQueryService: FilterToMongoQueryService,
  ) {
    this.vectorSearchService = vectorSearchService
    this.taskService = taskService
    this.taskCommandAdapterService = taskCommandAdapterService
    this.categoryService = categoryService
    this.filterToMongoQueryService = filterToMongoQueryService
  }

  private _convertDateToTimezone(task: ITaskPopulated, timezone: string) {
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
      categoryId: 'category',
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

  private _compressTasks(tasks: ITaskPopulated[]): Array<CompressedTask> {
    return tasks.map((task) => ({
      id: task.id.toString(),
      name: task.name,
      categoryName: task.category.name,
      boardName: task.board.name,
      workspaceName: task.workspace.name,
      description: task.description ? task.description.slice(0, 100) : '',
      isCompleted: task.isCompleted,
      dueDate: task.dueDate,
    }))
  }

  // [Tool 1]
  public async findTasksByFilter(
    dto: TaskFilterDTO,
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = validateInputBySchema(dto, TaskFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(
        dto,
        timezone,
        user.id,
        configurable.activeWorkspaceId,
      )

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const tasks = await this.taskService.getByFilter(mongoFilter, undefined, undefined, 30)

      if (tasks.length === 0) {
        const taskName = getFilterNameField(mongoFilter)

        if (taskName) {
          const semanticSearchResults = await this.vectorSearchService.similaritySearchTasks(
            [taskName],
            user.id,
            5,
          )
          const populatedSemanticResults = await this.taskService.getByCriteria({
            ids: semanticSearchResults.map((t) => t.id.toString()),
          })

          const compressedSemanticResults = this._compressTasks(populatedSemanticResults)

          if (semanticSearchResults.length === 0) {
            return `No tasks found matching the filter or semantically similar to the name "${taskName}".`
          }

          return (
            `No exact matches found. Here are some tasks that might be relevant based on the name "${taskName}":\n` +
            JSON.stringify(compressedSemanticResults)
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
    dto: { namesToFind: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    try {
      const { namesToFind } = dto
      const configurable = config.configurable as Configurable

      if (!namesToFind || namesToFind.length === 0) {
        return 'Task names required to find relevant tasks.'
      }

      const userId = configurable.user.id
      console.log(dto)
      console.log(userId)
      const tasks = await this.vectorSearchService.similaritySearchTasks(namesToFind, userId, 30)
      console.log(tasks)
      const populatedTasks = await this.taskService.getByCriteria({
        ids: tasks.map((t) => t.id.toString()),
      })

      const compressedTasks = this._compressTasks(populatedTasks)

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
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const tasks = dto.tasks

      if (!tasks || tasks.length === 0) {
        return new FailedToolResult('No tasks provided for creation.')
      }

      const errors: string[] = []

      const extendedTasks = await this._extendTaskCreateDTOWithContext(tasks, errors, user.id)

      const validationSchemaMessages = validateInputBySchema(dto, TaskCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Tasks schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
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

      return new SuccessToolResult({
        data: createResult.data.map((task) => ({ id: task.id, name: task.name })),
        logId: createResult.logId,
        actions: {
          create: {
            tasks: createResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating tasks: ${(e as Error).message}`)
    }
  }

  public async editTasks(dto: EditTasksDTO, config: LangGraphRunnableConfig): Promise<IToolResult> {
    const configurable = config.configurable as Configurable

    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    try {
      const categoryIdValidationMessage = dto.changes.categoryId
        ? await this._validateCategoryId(dto.changes.categoryId, user.id)
        : ''

      if (categoryIdValidationMessage) {
        return new FailedToolResult(categoryIdValidationMessage)
      }

      const errors: string[] = []

      const validationSchemaMessages = validateInputBySchema(dto, EditTasksSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        timezone,
        user,
      )

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

      return new SuccessToolResult({
        data: dataWithChangedColumns,
        logId: editResult.logId,
        actions: {
          edit: {
            tasks: editResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error editing tasks: ${(e as Error).message}`)
    }
  }

  public async cloneTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No tasks provided for cloning.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while cloning tasks:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const cloneResult = await this.taskService.clone({ ids }, user)

      if (!cloneResult) {
        return new FailedToolResult('Tasks cloning failed.')
      }

      if (cloneResult.data && cloneResult.data.length === 0) {
        return new FailedToolResult('No tasks were cloned.')
      } else if (!cloneResult.data) {
        return new FailedToolResult('Tasks cloning failed.')
      }

      return new SuccessToolResult({
        data: cloneResult.data.map((task) => task.id),
        logId: cloneResult.logId,
        actions: {
          clone: {
            tasks: cloneResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error cloning tasks: ${(e as Error).message}`)
    }
  }

  public async archiveTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
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
            '\nPlease correct it and try again.',
        )
      }

      const archiveResult = await this.taskService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Tasks archiving failed.')
      }

      if (archiveResult.data && archiveResult.data.length === 0) {
        return new FailedToolResult('No tasks were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Tasks archiving failed.')
      }

      return new SuccessToolResult({
        data: archiveResult.data.map((task) => task.id),
        logId: archiveResult.logId,
        actions: {
          archive: {
            tasks: archiveResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving tasks: ${(e as Error).message}`)
    }
  }

  public async deleteTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
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
            '\nPlease correct it and try again.',
        )
      }

      const tasksToDelete = await this.taskService.getByCriteria({ ids }, user.id)

      await this.taskService.delete({ ids }, user)

      return new SuccessToolResult({
        data: tasksToDelete.map((task) => task.id),
        actions: {
          delete: {
            tasks: tasksToDelete,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting tasks: ${(e as Error).message}`)
    }
  }

  public async recoverTasks(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
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
            '\nPlease correct it and try again.',
        )
      }

      const recoverResult = await this.taskService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Tasks recovering failed.')
      }

      if (recoverResult.data && recoverResult.data.length === 0) {
        return new FailedToolResult('No tasks were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Tasks recovering failed.')
      }

      return new SuccessToolResult({
        data: recoverResult.data.map((task) => task.id),
        logId: recoverResult.logId,
        actions: {
          recover: {
            tasks: recoverResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering tasks: ${(e as Error).message}`)
    }
  }

  private async _extendTaskCreateDTOWithContext(
    tasks: TaskCreateDTO['tasks'],
    errors: string[],
    userId: Types.ObjectId,
  ): Promise<TaskDTO[]> {
    const extendedTasks: TaskDTO[] = []

    const categoryIdsSet = new Set<string>()

    for (const task of tasks) {
      categoryIdsSet.add(task.categoryId)
    }

    const categoryIds = Array.from(categoryIdsSet)

    const existingCategories = await this.categoryService.getByCriteria(
      { ids: categoryIds },
      userId,
    )

    const existingCategoriesMap = new Map<string, ICategoryPopulated>()

    for (const category of existingCategories) {
      existingCategoriesMap.set(category.id.toString(), category)
    }

    for (const task of tasks) {
      const category = existingCategoriesMap.get(task.categoryId)

      if (!category) {
        errors.push(`Category with ID ${task.categoryId} not found.`)

        continue
      }

      const closestColor = task.color ? this.taskService.getNearestColor(task.color) : undefined

      const taskExtended: TaskDTO = {
        ...task,
        color: closestColor,
        boardId: category.board.id.toString(),
        workspaceId: category.workspace.id.toString(),
      }

      if (task.dueDate) {
        if (task.dueTime) {
          const parsedDueTime = task.dueTime.split(':')

          taskExtended.dueHours = parseInt(parsedDueTime[0], 10)
          taskExtended.dueMinutes = parseInt(parsedDueTime[1], 10)

          delete (taskExtended as any).dueTime // Remove dueTime as it's now split into hours and minutes
        }
      }

      extendedTasks.push(taskExtended)
    }

    return extendedTasks
  }

  private async _validateCategoryId(categoryId: string, userId: Types.ObjectId): Promise<string> {
    const categoryCount = await this.categoryService.getCount({ id: categoryId }, userId)

    if (categoryCount === 0) {
      return `Category with ID ${categoryId} not found.`
    }

    return ''
  }
}
