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
    }
  }

  public async searchTasks(
    _id: string,
    args: {
      mongo_filter?: FilterQuery<ITaskRawString>
      search_query?: string
      limit?: number
    },
    userId: string,
  ) {
    const HARD_SEARCH_LIMIT = 2000

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
  ): Promise<ITaskCreatePopulated[]> {
    const uniqueCategoryIds = Array.from(
      new Set(tasks.filter((task) => task.category).map((task) => task.category)),
    )

    const categories = await this.categoryService.getByCriteria(
      { ids: uniqueCategoryIds },
      new Types.ObjectId(userId),
    )

    return tasks.map((task) => {
      const category = categories.find((c) => c.id.toString() === task.category)

      return {
        ...toServerCaseKeys(task),
        id: task.id,
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
        order: task.order,
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

  private _transformRawUpdateToDTO(tasksRaw: UpdateTasksDTO['updates']): TaskEditManyDTO {
    return tasksRaw.map((task) => {
      const update: TaskEditDTO = {
        id: task._id,
      }

      if (typeof task.name !== 'undefined') update.name = task.name
      if (typeof task.order !== 'undefined') update.order = Math.min(task.order, 1)
      if (typeof task.is_completed !== 'undefined') update.isCompleted = task.is_completed
      if (typeof task.tags !== 'undefined') update.tags = task.tags
      if (typeof task.description !== 'undefined') update.description = task.description
      if (typeof task.due_date !== 'undefined') update.dueDate = task.due_date
      if (typeof task.due_hours !== 'undefined') update.dueHours = task.due_hours
      if (typeof task.due_minutes !== 'undefined') update.dueMinutes = task.due_minutes
      if (typeof task.color !== 'undefined') update.color = task.color
      if (typeof task.workspace !== 'undefined') update.workspaceId = task.workspace
      if (typeof task.board !== 'undefined') update.boardId = task.board
      if (typeof task.category !== 'undefined') update.categoryId = task.category

      return update
    })
  }

  public async createTasks(
    id: string,
    args: CreateTasksDTO,
    _userId: string,
    config: Record<string, any>,
  ) {
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

    const populatedTasks = await this._populateTasksParentData(args.tasks, user.id.toString())

    let dtoTasks = this._transformRawCreateToDTO(populatedTasks, user.id.toString())

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: id, role: 'operation' },
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
            toolCallId: id,
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
        toolCallId: id,
      },
      config,
    )

    return new SuccessToolResult(`Successfully created ${createdTasks.data.length} tasks.`)
  }

  public async updateTasks(
    id: string,
    args: UpdateTasksDTO,
    _userId: string,
    config: Record<string, any>,
  ) {
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

    let dtoTasks = this._transformRawUpdateToDTO(args.updates)

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: id, role: 'operation' },
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
            toolCallId: id,
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
        toolCallId: id,
      },
      config,
    )

    return new SuccessToolResult(`Successfully updated ${updatedTasks.data.length} tasks.`)
  }
}
