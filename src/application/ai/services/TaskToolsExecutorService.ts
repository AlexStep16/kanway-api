import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { TaskDTO } from '@/application/dtos/TaskDTO.ts'
import TaskRepository from '@/application/repositories/TaskRepository.ts'
import { CategoryService } from '@/application/services/CategoryService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { ITaskRawString } from '@/domain/entities/ITaskRawString.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { FilterQuery, Types } from 'mongoose'
import { ConfirmationEntityToolResult } from '../tools/helpers/ConfirmationEntityToolResult.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.ts'
import { toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { CreateTasksDTO, CreateTasksDTOSchema } from '../dtos/CreateTasksDTO.ts'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.ts'
import z from 'zod'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { UpdateTasksDTO, UpdateTasksDTOSchema } from '../dtos/UpdateTasksDTO.ts'
import { TaskEditDTO } from '@/application/dtos/TaskEditDTO.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { IResponseWithLog } from '@/application/interfaces/IResponseWithLog.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'
import { TaskEditManyDTO } from '@/application/dtos/TaskEditManyDTO.ts'
import { AbstractToolExecutor } from './AbstractToolExecutor.ts'
import { MoveTaskDTO, MoveTaskDTOSchema } from '../dtos/MoveTaskDTO.ts'
import { TaskMoveDTO } from '@/application/dtos/TaskMoveDTO.ts'
import { DispatchPayload } from './ToolDispatcherService.ts'

type ITaskCreatePopulated = Partial<Omit<ITaskPopulated, 'id' | 'createdAt' | 'updatedAt'>> & {
  id: string
}

export class TaskToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private taskRepository: TaskRepository,

    private taskService: TaskService,
    private categoryService: CategoryService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
  ) {
    super()

    this.toolRegistry = {
      search_tasks: this.searchTasks.bind(this),
      create_tasks: this.createTasks.bind(this),
      update_tasks: this.updateTasks.bind(this),
      move_task: this.moveTask.bind(this),
    }
  }

  public async searchTasks(payload: DispatchPayload) {
    const HARD_SEARCH_LIMIT = 2000

    const { toolCall, userId } = payload

    const args = toolCall.args as {
      mongo_filter?: FilterQuery<ITaskRawString>
      search_query?: string
      limit?: number
    }

    const { mongo_filter = {}, search_query = '', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const baseFilter: FilterQuery<ITaskRawString> = {
      is_deleted: { $ne: true },
      is_deleted_external: { $ne: true },
    }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.taskRepository.getCountByFilter(unionFilter)

    const tasks = await this.taskRepository.findByFilter<ITaskRawString>(unionFilter, undefined, {
      isMongoCase: true,
      limit: scaledLimit,
    })

    if (search_query) {
      if (tasks.length === 0) {
        return {
          tasks: [],
          count: 0,
          hasMore: false,
        }
      }

      const fuse = new Fuse(tasks, {
        keys: ['name'],
        threshold: 0.3,
        includeScore: true,
      })

      const searchResults = fuse.search(search_query)

      const pagedResults = searchResults
        .sort((a, b) => (a.score || 0) - (b.score || 0))
        .slice(0, scaledLimit)
        .map((result) => result.item)

      return {
        tasks: pagedResults,
        count: searchResults.length,
        hasMore: searchResults.length > scaledLimit,
      }
    }

    const hasMore = filteredCount > tasks.length

    return {
      tasks,
      count: filteredCount,
      hasMore,
    }
  }

  private async _populateTasksParentData(
    tasks: CreateTasksDTO['tasks'],
    userId: string,
    tempToRealIdMap: Record<string, string>,
  ): Promise<ITaskCreatePopulated[]> {
    const uniqueCategoryIds = Array.from(
      new Set(
        tasks
          .filter((task) => tempToRealIdMap[task.category] || task.category)
          .map((task) => tempToRealIdMap[task.category] || task.category),
      ),
    )

    const categories = await this.categoryService.getByCriteria(
      { ids: uniqueCategoryIds },
      new Types.ObjectId(userId),
    )

    return tasks.map((task) => {
      const category = categories.find(
        (c) => c.id.toString() === (tempToRealIdMap[task.category] || task.category),
      )

      return {
        ...toServerCaseKeys(task),
        id: task._id,
        workspace: {
          id: category!.workspace.id,
          name: category!.workspace.name,
        },
        board: {
          id: category!.board.id,
          name: category!.board.name,
        },
        category: {
          id: category!.id,
          name: category!.name,
        },
      }
    })
  }

  private _transformRawCreateToDTO(
    tasksRaw: ITaskCreatePopulated[],
    userId: string,
  ): (TaskDTO & { id: string })[] {
    return tasksRaw.map((task) => {
      return {
        id: task.id,
        name: task.name!,
        isCompleted: task.isCompleted,
        tags: task.tags || [],
        userId: new Types.ObjectId(userId),
        description: task.description,
        dueDate: task.dueDate,
        dueHours: task.dueHours,
        dueMinutes: task.dueMinutes,
        color: task.color ? { ...task.color } : undefined,
        workspaceId: task.workspace!.id.toString(),
        boardId: task.board!.id.toString(),
        categoryId: task.category!.id.toString(),
      }
    })
  }

  private _transformRawUpdateToDTO(
    tasksRaw: UpdateTasksDTO['updates'],
    tempToRealIdMap: Record<string, string>,
  ): TaskEditManyDTO {
    return tasksRaw.map((task) => {
      const update: TaskEditDTO = {
        id: tempToRealIdMap[task._id] || task._id, // Use real ID if available in the map otherwise fallback to the original ID
      }

      if (typeof task.name !== 'undefined') update.name = task.name
      if (typeof task.is_completed !== 'undefined') update.isCompleted = task.is_completed
      if (typeof task.tags !== 'undefined') update.tags = task.tags
      if (typeof task.description !== 'undefined') update.description = task.description
      if (typeof task.due_date !== 'undefined') update.dueDate = task.due_date
      if (typeof task.due_hours !== 'undefined') update.dueHours = task.due_hours
      if (typeof task.due_minutes !== 'undefined') update.dueMinutes = task.due_minutes
      if (typeof task.color !== 'undefined') update.color = task.color
      if (typeof task.workspace !== 'undefined')
        update.workspaceId = tempToRealIdMap[task.workspace] || task.workspace
      if (typeof task.board !== 'undefined')
        update.boardId = tempToRealIdMap[task.board] || task.board
      if (typeof task.category !== 'undefined')
        update.categoryId = tempToRealIdMap[task.category] || task.category

      return update
    })
  }

  public async createTasks(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload

    const args = toolCall.args as CreateTasksDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = CreateTasksDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const populatedTasks = await this._populateTasksParentData(
      args.tasks,
      user.id.toString(),
      tempToRealIdMap,
    )

    let dtoTasks = this._transformRawCreateToDTO(populatedTasks, user.id.toString())

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Task creation cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoTasks = dtoTasks.filter((task) => selectedIds.includes(task.id))
        } else {
          return new FailedToolResult('Task creation pending user confirmation.')
        }
      } else {
        const mockCreateTasks = await this.taskService.createMany(dtoTasks, user, undefined, true)

        if (mockCreateTasks.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockCreateTasks.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for task creation.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Создаю задачи',
      },
      config,
    )

    const createdTasks = await this.taskService.createMany(dtoTasks, user)

    const logs = await this.operationLogService.getByCriteria(
      { id: createdTasks.logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const tempToRealIdMapNew: Record<string, string> = {}

    for (let i = 0; i < createdTasks.data.length; i++) {
      tempToRealIdMapNew[args.tasks[i]._id] = createdTasks.data[i].id.toString()
    }

    const resultInfo = createdTasks.data.map((task) => ({
      id: task.id,
      name: task.name,
    }))

    const resultMessage = `Successfully created ${createdTasks.data.length} tasks: ${JSON.stringify(resultInfo)}`

    return new SuccessToolResult(resultMessage, {
      tempToRealIdMap: tempToRealIdMapNew,
    })
  }

  public async updateTasks(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload

    const args = toolCall.args as UpdateTasksDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = UpdateTasksDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    let dtoTasks = this._transformRawUpdateToDTO(args.updates, tempToRealIdMap)

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Task update cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoTasks = dtoTasks.filter((task) => selectedIds.includes(task.id))
        }
      } else {
        const mockUpdateTasks = await this.taskService.editMany(dtoTasks, user, undefined, true)

        if (mockUpdateTasks.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockUpdateTasks.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for task update.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Обновляю задачи',
      },
      config,
    )

    const updatedTasks = (await this.taskService.editMany(dtoTasks, user)) as IResponseWithLog<
      ITaskPopulated[]
    >
    const logs = await this.operationLogService.getByCriteria(
      { id: updatedTasks.logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = logs[0].entitiesAfter

    const resultMessage = `Successfully updated ${updatedTasks.data.length} tasks: ${JSON.stringify(resultInfo)}`

    return new SuccessToolResult(resultMessage)
  }

  public async moveTask(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload

    const args = toolCall.args as MoveTaskDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = MoveTaskDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const dto: TaskMoveDTO = {
      id: tempToRealIdMap[args.id] || args.id, // Use real ID if available in the map otherwise fallback to the original ID
      beforeTaskId: args.before_task_id
        ? tempToRealIdMap[args.before_task_id] || args.before_task_id
        : undefined,
      afterTaskId: args.after_task_id
        ? tempToRealIdMap[args.after_task_id] || args.after_task_id
        : undefined,
      newCategoryId: args.new_category_id
        ? tempToRealIdMap[args.new_category_id] || args.new_category_id
        : undefined,
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Task move cancelled by user.')
        }
      } else {
        const mockMoveTask = await this.taskService.move(dto, user, undefined, true)

        if (mockMoveTask.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockMoveTask.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for task move.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Перемещаю задачи',
      },
      config,
    )

    const result = await this.taskService.move(dto, user)

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = logs[0].entitiesAfter

    const resultMessage = `Successfully moved ${result.data.length} tasks: ${JSON.stringify(resultInfo)}`

    return new SuccessToolResult(resultMessage)
  }
}
