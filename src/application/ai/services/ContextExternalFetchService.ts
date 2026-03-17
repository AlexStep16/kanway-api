import { BoardService } from '@application/services/BoardService.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { TaskService } from '@application/services/TaskService.ts'
import { ToolCall } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { Configurable } from '../interfaces/Configurable.ts'
import dayjs from 'dayjs'
import { Types } from 'mongoose'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { TaskCreateDTO } from '../tools/schemes/create/taskCreateSchema.ts'
import { CategoryCreateDTO } from '../tools/schemes/create/categoryCreateSchema.ts'
import { BoardCreateDTO } from '../tools/schemes/create/boardCreateSchema.ts'
import { WorkspaceCreateDTO } from '../tools/schemes/create/workspaceCreateSchema.ts'

interface BaseExternalParams {
  toolCall: ToolCall
  config: RunnableConfig
}

export class ContextExternalFetchService {
  protected taskService: TaskService
  protected categoryService: CategoryService
  protected boardService: BoardService
  protected workspaceService: WorkspaceService

  constructor(
    taskService: TaskService,
    categoryService: CategoryService,
    boardService: BoardService,
    workspaceService: WorkspaceService,
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
  }

  public async createTasks({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as TaskCreateDTO
    const taskDtosWithId = args.tasks as (TaskCreateDTO['tasks'][0] & { tempId: string })[]
    const configurable = config.configurable as Configurable
    const allCategoryIds: string[] = taskDtosWithId.map((t) => t.categoryId)

    const categories = await this.categoryService.getByCriteria(
      { ids: allCategoryIds },
      config.configurable?.user?.id,
    )

    const filledTasks: Partial<ITaskPopulated>[] = []

    for (const taskDTO of taskDtosWithId) {
      const newId = new Types.ObjectId()

      taskDTO.tempId = newId.toHexString()

      const extendedTask = {
        tempId: newId,
        name: taskDTO.name,
        description: taskDTO.description,
        dueDate: taskDTO.dueDate,
        color: taskDTO.color,
        order: taskDTO.order,
        tags: taskDTO.tags,
        isCompleted: taskDTO.isCompleted,
      } as Partial<ITaskPopulated>

      if (taskDTO.dueDate && taskDTO.dueTime) {
        const collectedDateTime = taskDTO.dueDate + 'T' + taskDTO.dueTime

        const date = dayjs.tz(collectedDateTime, configurable.timezone).utc()

        extendedTask.dueDate = date.format('YYYY-MM-DD')
        extendedTask.dueHours = date.hour()
        extendedTask.dueMinutes = date.minute()
      }

      const category = categories.find((cat) => cat.id.toString() === taskDTO.categoryId)

      if (category) {
        extendedTask.category = {
          id: category.id,
          name: category.name,
        }
        extendedTask.board = {
          id: category.board.id,
          name: category.board.name,
        }
        extendedTask.workspace = {
          id: category.workspace.id,
          name: category.workspace.name,
        }
      }

      filledTasks.push(extendedTask)
    }

    return {
      entities: filledTasks,
      args: {
        tasks: taskDtosWithId,
      },
    }
  }

  public async createCategories({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as CategoryCreateDTO
    const categoryDtosWithId = args.categories as (CategoryCreateDTO['categories'][0] & {
      tempId: string
    })[]
    const allBoardIds: string[] = args.categories.map((c) => c.boardId)

    const boards = await this.boardService.getByCriteria(
      { ids: allBoardIds },
      config.configurable?.user?.id,
    )

    const filledCategories: Partial<ICategoryPopulated>[] = []

    for (const categoryDTO of categoryDtosWithId) {
      const newId = new Types.ObjectId()

      categoryDTO.tempId = newId.toHexString()

      const extendedCategory = {
        tempId: newId,
        name: categoryDTO.name,
        order: categoryDTO.order,
      } as Partial<ICategoryPopulated>

      const board = boards.find((b) => b.id.toString() === categoryDTO.boardId)

      if (board) {
        extendedCategory.board = {
          id: board.id,
          name: board.name,
        }
        extendedCategory.workspace = {
          id: board.workspace.id,
          name: board.workspace.name,
        }
      }

      filledCategories.push(extendedCategory)
    }

    return {
      entities: filledCategories,
      args: {
        categories: categoryDtosWithId,
      },
    }
  }

  public async createBoards({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as BoardCreateDTO
    const boardDtosWithId = args.boards as (BoardCreateDTO['boards'][0] & { tempId: string })[]
    const allWorkspaceIds: string[] = args.boards.map((b) => b.workspaceId)

    const workspaces = await this.workspaceService.getByCriteria(
      { ids: allWorkspaceIds },
      config.configurable?.user?.id,
    )

    const filledBoards: Partial<IBoardPopulated>[] = []

    for (const boardDTO of boardDtosWithId) {
      const newId = new Types.ObjectId()

      boardDTO.tempId = newId.toHexString()

      const extendedBoard = {
        tempId: newId,
        name: boardDTO.name,
        isFavorite: boardDTO.isFavorite,
        order: boardDTO.order,
      } as Partial<IBoardPopulated>

      const workspace = workspaces.find((w) => w.id.toString() === boardDTO.workspaceId)

      if (workspace) {
        extendedBoard.workspace = {
          id: workspace.id,
          name: workspace.name,
        }
      }

      filledBoards.push(extendedBoard)
    }

    return {
      entities: filledBoards,
      args: {
        boards: boardDtosWithId,
      },
    }
  }

  public createWorkspaces({ toolCall }: BaseExternalParams) {
    const args = toolCall.args as WorkspaceCreateDTO
    const workspaceDtosWithId = args.workspaces as (WorkspaceCreateDTO['workspaces'][0] & {
      tempId: string
    })[]

    const workspaces = []

    for (const workspaceDTO of workspaceDtosWithId) {
      const newId = new Types.ObjectId()

      workspaceDTO.tempId = newId.toHexString()

      const extendedWorkspace = {
        tempId: newId,
        name: workspaceDTO.name,
        color: workspaceDTO.color,
        order: workspaceDTO.order,
      }

      workspaces.push(extendedWorkspace)
    }

    return {
      entities: workspaces,
      args: {
        workspaces: workspaceDtosWithId,
      },
    }
  }

  public async editTasks({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as { filter: { ids: string[] } }
    const ids: string[] = args.filter.ids || []

    return this.taskService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async editCategories({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as { filter: { ids: string[] } }
    const ids: string[] = args.filter.ids || []

    return this.categoryService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async editBoards({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as { filter: { ids: string[] } }
    const ids: string[] = args.filter.ids || []

    return this.boardService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async editWorkspaces({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as { filter: { ids: string[] } }
    const ids: string[] = args.filter.ids || []

    return this.workspaceService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsTasks({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.taskService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsCategories({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.categoryService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsBoards({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.boardService.getByCriteria({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsWorkspaces({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.workspaceService.getByCriteria({ ids }, config.configurable?.user?.id)
  }
}
