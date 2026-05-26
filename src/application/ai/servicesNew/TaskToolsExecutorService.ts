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
import { SearchTasksDTO } from '../tools/schemes/SearchTasksScheme.js'
import { UpdateTasksDTO } from '../tools/schemes/UpdateTasksScheme.js'
import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import { transformRawUpdateToDTO } from '../tools/helpers/UpdateTasksHelpers.js'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { ISearchEntitiesContent } from '@/application/interfaces/Statuses/Content/ISearchEntitiesContent.js'
import { StatusLog } from '@/application/types/StatusLog.js'

export class TaskToolsExecutorService {
  constructor(
    private taskRepository: TaskRepository,

    private taskService: TaskService,
    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
  ) {}

  public async searchTasks(
    payload: SearchTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const toolCall = context.toolCall!

    const configurable = config.configurable as Configurable

    const { mongoQuery, humanReadable } = await this.filterToMongoQueryService.prepare(
      payload,
      configurable.timezone,
      configurable.user.id,
    )

    const toolContent: ISearchEntitiesContent = {
      filterText: humanReadable,
    }
    const log: StatusLog = {
      id: new Types.ObjectId().toString(),
      type: StatusTypesEnum.TOOL,
      state: StatusStatesEnum.IN_PROGRESS,
      content: {
        id: toolCall.id!,
        name: 'search_tasks',
        content: toolContent,
      },
    }
    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, log)
    await new Promise((resolve) => setTimeout(resolve, 5000)) // mock to see the in progress status

    const tasks = await this.taskRepository.findByFilter(mongoQuery, session)
    const tasksSample = tasks.slice(0, 5).map((task) => ({
      id: task.id,
      name: task.name,
      dueDate: task.dueDate,
    }))
    const selection = await this.selectionService.addSelection(
      'task',
      tasks.map((t) => t.id.toString()),
      humanReadable,
      tasksSample,
      configurable.user.id.toString(),
    )

    log.state = StatusStatesEnum.COMPLETED
    log.content.content.ids = tasks.map((t) => t.id.toString())

    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, log)

    return new SuccessToolResult(
      `Found ${tasks.length} tasks matching the criteria: ${humanReadable}.\n` +
        `A selection with ${tasks.length} tasks has been created (ID: ${selection.id}) and can be used for further operations.` +
        `Sample of found tasks: ${JSON.stringify(tasksSample)}`,
      {
        selections: [selection],
      },
    )
  }

  public async updateTasks(
    payload: UpdateTasksDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const taskIds = await this._resolveTaskIds(payload)

    const objectIds = taskIds.map((id) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid task id: ${id}`)
      }

      return new Types.ObjectId(id)
    })

    const tasks = await this.taskRepository.findByFilter<ITask>(
      {
        _id: { $in: objectIds },
        user_id: configurable.user.id,
        is_deleted: false,
      },
      session,
      {
        limit: objectIds.length,
      },
    )

    const dtoTasks = transformRawUpdateToDTO(tasks, payload.updates)

    if (dtoTasks.length === 0) {
      throw new Error('No tasks to update')
    }

    let isDryRun = false

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      if (context.isApproved === undefined) {
        isDryRun = true
      } else if (context.isApproved === false) {
        return new FailedToolResult('Task update operation was rejected by the user.')
      }
    }

    const updateTasksResult = await this.taskService.editMany(
      dtoTasks,
      configurable.user,
      session,
      isDryRun,
    )

    if (updateTasksResult.logId) {
      if (isDryRun) {
        return new ConfirmationToolResult({
          logId: updateTasksResult.logId.toString(),
        })
      }

      return new SuccessToolResult(
        `Successfully updated ${updateTasksResult.data.length} tasks. Operation Log ID: ${updateTasksResult.logId.toString()}`,
        {
          logId: updateTasksResult.logId.toString(),
        },
      )
    }

    return new FailedToolResult('Failed to create operation log for tasks update.')
  }

  private async _resolveTaskIds(payload: UpdateTasksDTO): Promise<string[]> {
    let taskIds: string[] = []

    if (!payload.task_id && !payload.selection_id) {
      throw new Error('Either task_id or selection_id must be provided')
    }

    if (payload.selection_id) {
      const selection = await this.selectionService.getSelection(payload.selection_id)

      if (!selection) {
        throw new Error('Selection not found')
      }

      taskIds = selection.entityIds
    }

    if (payload.task_id) {
      taskIds = [payload.task_id]
    }

    if (taskIds.length === 0) {
      throw new Error('No tasks to update')
    }

    return taskIds
  }
}
