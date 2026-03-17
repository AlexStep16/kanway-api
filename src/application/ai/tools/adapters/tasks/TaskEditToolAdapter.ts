import { TaskService } from '@application/services/TaskService.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import { TaskCommandAdapterService } from '@/application/ai/services/TaskCommandAdapterService.ts'
import { ITask } from '@/domain/entities/ITask.ts'
import dayjs from 'dayjs'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import {
  CompleteTasksDTO,
  CompleteTasksSchema,
  EditTasksColorDTO,
  EditTasksColorSchema,
  EditTasksDescriptionDTO,
  EditTasksDescriptionSchema,
  EditTasksDueDateDTO,
  EditTasksDueDateSchema,
  EditTasksDueTimeDTO,
  EditTasksDueTimeSchema,
  EditTasksNameDTO,
  EditTasksNameSchema,
  EditTasksOrderDTO,
  EditTasksOrderSchema,
  EditTasksTagsDTO,
  EditTasksTagsSchema,
  MoveTasksDTO,
  MoveTasksSchema,
} from '../../schemes/update/taskEditSchemes.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'

export class TaskEditToolAdapter {
  private taskService: TaskService
  private categoryService: CategoryService
  private taskCommandAdapterService: TaskCommandAdapterService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    taskCommandAdapterService: TaskCommandAdapterService,
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.taskCommandAdapterService = taskCommandAdapterService
  }

  public async updateTasksName(
    dto: EditTasksNameDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksNameSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks name schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateEditStringAndExecute(
        dto.filter.ids,
        dto.name,
        'name',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = { id: task.id, name: task.name }

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

      return new FailedToolResult(`Error editing tasks name: ${(e as Error).message}`)
    }
  }

  public async updateTasksDescription(
    dto: EditTasksDescriptionDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksDescriptionSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks description schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateEditStringAndExecute(
        dto.filter.ids,
        dto.description,
        'description',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = {
          id: task.id,
          description: task.description,
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

      return new FailedToolResult(`Error editing tasks description: ${(e as Error).message}`)
    }
  }

  public async updateTasksDate(
    dto: EditTasksDueDateDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksDueDateSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks due date schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateEditDateAndExecute(
        dto.filter.ids,
        dto.dueDate,
        configurable.timezone || 'Europe/Moscow',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = {
          id: task.id,
          dueDate: dayjs(task.dueDate)
            .tz(configurable.timezone || 'Europe/Moscow')
            .toISOString(),
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

      return new FailedToolResult(`Error editing tasks due date: ${(e as Error).message}`)
    }
  }

  public async updateTasksTime(
    dto: EditTasksDueTimeDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksDueTimeSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks due time schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateEditTimeAndExecute(
        dto.filter.ids,
        dto.dueTime,
        configurable.timezone || 'Europe/Moscow',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = {
          id: task.id,
          dueHours: task.dueHours,
          dueMinutes: task.dueMinutes,
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

      return new FailedToolResult(`Error editing tasks due time: ${(e as Error).message}`)
    }
  }

  public async updateTasksTags(
    dto: EditTasksTagsDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksTagsSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks tags schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateEditArrayAndExecute(
        dto.filter.ids,
        dto.tags,
        'tags',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = { id: task.id, tags: task.tags }

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

      return new FailedToolResult(`Error editing tasks tags: ${(e as Error).message}`)
    }
  }

  public async updateTasksColor(
    dto: EditTasksColorDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksColorSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks color schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskCommandAdapterService.translateEditColorAndExecute(
        dto.filter.ids,
        dto.update,
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = { id: task.id, color: task.color }

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

      return new FailedToolResult(`Error editing tasks color: ${(e as Error).message}`)
    }
  }

  public async moveTasks(dto: MoveTasksDTO, config: LangGraphRunnableConfig): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, MoveTasksSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in move Tasks schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const categoriesCount = await this.categoryService.getCount({ id: dto.categoryId }, user.id)

      if (categoriesCount === 0) {
        return new FailedToolResult(`Category with ID ${dto.categoryId} not found.`)
      }

      const editResult = await this.taskCommandAdapterService.translateEditCategoryAndExecute(
        dto.filter.ids,
        dto.categoryId,
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITaskPopulated> = {
          id: task.id,
          category: task.category,
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

      return new FailedToolResult(`Error moving tasks: ${(e as Error).message}`)
    }
  }

  public async completeTasks(
    dto: CompleteTasksDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, CompleteTasksSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in complete Tasks schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskService.edit(
        {
          isCompleted: !!dto.isCompleted,
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = {
          id: task.id,
          isCompleted: task.isCompleted,
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

      return new FailedToolResult(`Error completing tasks: ${(e as Error).message}`)
    }
  }

  public async updateTasksOrder(
    dto: EditTasksOrderDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditTasksOrderSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Tasks order schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.taskService.edit(
        {
          order: parseInt(dto.order as any, 10),
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: Partial<ITask> = {
          id: task.id,
          order: task.order,
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

      return new FailedToolResult(`Error updating tasks order: ${(e as Error).message}`)
    }
  }
}
