import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import TaskRepository from '@/application/repositories/TaskRepository.js'
import { TaskService } from '@/application/services/TaskService.js'
import { ITask } from '@/domain/entities/ITask.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { RunnableConfig } from '@langchain/core/runnables'
import { ClientSession, Types } from 'mongoose'
import { ConfirmationToolResult } from '../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import { SearchTasksDTO } from '../tools/schemes/TaskManager/SearchTasksScheme.js'
import { UpdateTasksDTO } from '../tools/schemes/TaskManager/UpdateTasksScheme.js'
import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import {
  transformRawUpdateToDTO,
  transformRawUpdateToHumanReadableFilters,
} from '../tools/helpers/UpdateTasksHelpers.js'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { ISearchEntitiesContent } from '@/application/interfaces/statuses/content/ISearchEntitiesContent.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import { ToolStatusLogLifecycleService } from './ToolStatusLogLifecycleService.js'
import { DeleteArchiveTasksDTO } from '../tools/schemes/TaskManager/DeleteArchiveTasksScheme.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { CloneTasksDTO } from '../tools/schemes/TaskManager/CloneTasksScheme.js'
import { RecoverTasksDTO } from '../tools/schemes/TaskManager/RecoverTasksScheme.js'
import { MoveTasksDTO } from '../tools/schemes/TaskManager/MoveTasksScheme.js'
import { ColumnService } from '@/application/services/ColumnService.js'
import { SearchFilter } from '@/application/types/SearchFilter.js'
import {
  getSearchHumanReadableFilter,
  getTaskColorHumanFilter,
} from '../tools/helpers/SearchTasksHumanReadableFilters.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'
import { CreateTasksDTO } from '../tools/schemes/TaskManager/CreateTasksScheme.js'
import { TaskDTO } from '@/application/dtos/TaskDTO.js'

export class TaskToolsExecutorService {
  constructor(
    private taskRepository: TaskRepository,

    private taskService: TaskService,
    private columnService: ColumnService,
    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
    private toolStatusLogLifecycleService = new ToolStatusLogLifecycleService(),
  ) {}

  public async searchTasks(
    payload: SearchTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const toolCall = context.toolCall!
    const configurable = config.configurable as Configurable
    const { filters, fields_to_include = [] } = payload

    const mongoQuery = await this.filterToMongoQueryService.prepare(
      filters,
      configurable.timezone,
      configurable.user.id,
      { entityType: 'task' },
    )
    const humanReadableFilters = this._transformSearchFiltersToHumanReadableFilters(filters)

    const toolContent: ISearchEntitiesContent = {
      filters: humanReadableFilters,
    }
    const statusLog: StatusLog = {
      id: new Types.ObjectId().toString(),
      type: StatusTypesEnum.TOOL,
      state: StatusStatesEnum.IN_PROGRESS,
      content: {
        id: toolCall.id!,
        name: 'search_tasks',
        content: toolContent,
      },
    }
    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, statusLog)

    try {
      const tasks = await this.taskService.getByFilter(mongoQuery, session)
      const tasksSample = buildEntitySamples(EntityTypesEnum.TASK, tasks, {
        timezone: configurable.timezone,
        additionalFields: fields_to_include,
      })
      const selection = await this.selectionService.create(
        {
          entityType: EntityTypesEnum.TASK,
          entityIds: tasks.map((t) => t.id),
          humanReadableFilters,
          sample: tasksSample,
          count: tasks.length,
        },
        configurable.user.id,
        session,
      )

      statusLog.state = StatusStatesEnum.COMPLETED
      toolContent.ids = tasks.map((t) => t.id.toString())

      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      return new SuccessToolResult(
        JSON.stringify({
          selection_id: selection.id.toString(),
          sample: tasksSample,
          count: tasks.length,
          human_readable_filters: humanReadableFilters,
        }),
        {
          selections: [selection],
        },
      )
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async updateTasks(
    payload: UpdateTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const taskIds = await this._resolveTaskIds(payload, configurable.user.id, session)
    const toolCall = context.toolCall!

    const humanReadableUpdates = transformRawUpdateToHumanReadableFilters(payload.updates)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'update_tasks',
      toolContent: {
        count: taskIds.length,
        filters: humanReadableUpdates,
      },
    })

    try {
      const tasks = await this.taskRepository.findByFilter<ITask>(
        {
          _id: { $in: taskIds },
          user_id: configurable.user.id,
        },
        session,
        {
          limit: taskIds.length,
        },
      )

      const dtoTasks = transformRawUpdateToDTO(tasks, payload.updates, configurable.timezone)

      if (dtoTasks.length === 0) {
        throw new Error('No tasks to update')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Task update operation was rejected by the user.')
        }
      }

      const updateTasksResult = await this.taskService.editMany(
        dtoTasks,
        configurable.user,
        session,
        isDryRun,
      )

      if (updateTasksResult.logId) {
        const operationLogId = updateTasksResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully updated ${updateTasksResult.data.length} tasks. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for tasks update.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async createTasks(
    payload: CreateTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'create_tasks',
      toolContent: {
        count: payload.tasks.length,
      },
    })

    try {
      const dtoTasks: TaskDTO[] = payload.tasks.map((task) => ({
        name: task.name,
        columnId: task.column_id,
        description: task.description,
        dueDate: task.due_date,
        dueHours: task.due_hours,
        dueMinutes: task.due_minutes,
        isCompleted: task.is_completed,
        color: task.color,
        tags: task.tags,
        priority: task.priority,
      }))

      if (dtoTasks.length === 0) {
        throw new Error('No tasks to create')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Task create operation was rejected by the user.')
        }
      }

      const createTasksResult = await this.taskService.createMany(
        dtoTasks,
        configurable.user,
        session,
        isDryRun,
      )

      if (createTasksResult.logId) {
        const operationLogId = createTasksResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.count = createTasksResult.data.length
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully created ${createTasksResult.data.length} tasks. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for tasks create.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private async _resolveTaskIds(
    payload: {
      selection_id?: string
      task_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<string[]> {
    let taskIds: string[] = []

    if (!payload.task_ids && !payload.selection_id) {
      throw new Error('Either task_ids or selection_id must be provided')
    }

    if (payload.selection_id) {
      const selections = await this.selectionService.getByCriteria(
        {
          id: payload.selection_id,
        },
        userId,
        session,
      )

      if (selections.length === 0) {
        throw new Error('Selection not found')
      }

      const selection = selections[0]

      taskIds = selection.entityIds.map((id) => id.toString())
    }

    if (payload.task_ids) {
      payload.task_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid task id: ${id}`)
        }
      })

      taskIds = Array.from(new Set(payload.task_ids))
    }

    if (taskIds.length === 0) {
      throw new Error('No tasks to update')
    }

    return taskIds
  }

  private async _resolveHumanReadableFilters(
    payload: {
      selection_id?: string
      task_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    if (payload.selection_id) {
      const selections = await this.selectionService.getByCriteria(
        {
          id: payload.selection_id,
        },
        userId,
        session,
      )

      if (selections.length === 0) {
        throw new Error('Selection not found')
      }

      const selection = selections[0]

      return selection.humanReadableFilters
    }

    if (payload.task_ids) {
      payload.task_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid task id: ${id}`)
        }
      })

      const tasks = await this.taskService.getByCriteria({ ids: payload.task_ids }, userId, session)

      return tasks.map((task) => ({
        text: 'Название',
        value: task.name,
      }))
    }

    return []
  }

  private async _resolveMoveHumanReadableFilters(
    payload: MoveTasksDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    const filters: ITextValue[] = []

    if (payload.toStart) {
      filters.push({
        text: 'Позиция',
        value: 'в начало',
      })
    }

    if (payload.toEnd) {
      filters.push({
        text: 'Позиция',
        value: 'в конец',
      })
    }

    const anchorTaskIds = Array.from(
      new Set([payload.beforeTaskId, payload.afterTaskId].filter(Boolean) as string[]),
    )
    const anchorTaskNamesById = new Map<string, string>()

    if (anchorTaskIds.length > 0) {
      const anchorTasks = await this.taskService.getByCriteria(
        { ids: anchorTaskIds },
        userId,
        session,
      )

      anchorTasks.forEach((task) => {
        anchorTaskNamesById.set(task.id.toString(), task.name)
      })
    }

    if (payload.beforeTaskId) {
      filters.push({
        text: 'Перед задачей',
        value: anchorTaskNamesById.get(payload.beforeTaskId) ?? payload.beforeTaskId,
      })
    }

    if (payload.afterTaskId) {
      filters.push({
        text: 'После задачи',
        value: anchorTaskNamesById.get(payload.afterTaskId) ?? payload.afterTaskId,
      })
    }

    if (payload.newColumnId) {
      const columns = await this.columnService.getByCriteria(
        { id: payload.newColumnId },
        userId,
        session,
      )

      filters.push({
        text: 'Новая категория',
        value: columns[0]?.name ?? payload.newColumnId,
      })
    }

    return filters
  }

  public async deleteArchiveTasks(
    payload: DeleteArchiveTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const taskIds = await this._resolveTaskIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const mainFunction = payload.soft_delete
      ? this.taskService.archive.bind(this.taskService)
      : this.taskService.delete.bind(this.taskService)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'delete_archive_tasks',
      toolContent: {
        count: taskIds.length,
        filters: humanReadableFilters,
        isSoftDelete: payload.soft_delete,
      },
    })

    let isDryRun = false
    try {
      if (
        [AiConfirmationTypeEnum.ALWAYS, AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE].includes(
          configurable.aiConfirmationType,
        )
      ) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Task update operation was rejected by the user.')
        }
      }

      const result = await mainFunction(
        {
          ids: taskIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      const actionString = payload.soft_delete ? 'archived' : 'deleted'

      if (result.logId) {
        const operationLogId = result.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        let tasksProcessedCount = 0

        if (result.data && 'deletedCount' in result.data) {
          tasksProcessedCount = result.data.deletedCount
        } else if (result.data && Array.isArray(result.data)) {
          tasksProcessedCount = result.data.length
        } else {
          return new FailedToolResult('No tasks were affected by the operation.')
        }

        return new SuccessToolResult(
          `Successfully ${actionString} ${tasksProcessedCount} tasks. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult(`Failed to create operation log for tasks ${actionString}.`)
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async cloneTasks(
    payload: CloneTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const taskIds = await this._resolveTaskIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'clone_tasks',
      toolContent: {
        count: taskIds.length,
        filters: humanReadableFilters,
      },
    })

    try {
      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Task clone operation was rejected by the user.')
        }
      }

      const cloneTasksResult = await this.taskService.clone(
        {
          ids: taskIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (cloneTasksResult.logId) {
        const operationLogId = cloneTasksResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully cloned ${cloneTasksResult.data.length} tasks. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for tasks clone.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async recoverTasks(
    payload: RecoverTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const taskIds = await this._resolveTaskIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'recover_tasks',
      toolContent: {
        count: taskIds.length,
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Task recover operation was rejected by the user.')
        }
      }

      const recoverTasksResult = await this.taskService.recover(
        {
          ids: taskIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (recoverTasksResult.logId) {
        const operationLogId = recoverTasksResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully recovered ${recoverTasksResult.data.length} tasks. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for tasks recover.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async moveTasks(
    payload: MoveTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const taskIds = await this._resolveTaskIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveMoveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'move_tasks',
      toolContent: {
        count: taskIds.length,
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Task move operation was rejected by the user.')
        }
      }

      const moveTasksResult = await this.taskService.moveMany(
        {
          ids: taskIds,
          beforeTaskId: payload.beforeTaskId,
          afterTaskId: payload.afterTaskId,
          toStart: payload.toStart,
          toEnd: payload.toEnd,
          newColumnId: payload.newColumnId,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (moveTasksResult.logId) {
        const operationLogId = moveTasksResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully moved ${moveTasksResult.data.length} tasks. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for tasks move.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private _transformSearchFiltersToHumanReadableFilters(filters: SearchFilter[]): ITextValue[] {
    return filters
      .map((filter) => {
        try {
          const { field, ...operator } = filter

          if (field === 'color') return getTaskColorHumanFilter(operator)

          return getSearchHumanReadableFilter(filter)
        } catch (error) {
          console.error(
            `Error transforming filter to human-readable format: ${error instanceof Error ? error.message : error}`,
          )
          return null
        }
      })
      .filter((filter): filter is ITextValue => filter !== null)
  }
}
