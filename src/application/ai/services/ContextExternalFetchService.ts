import { BoardService } from '@application/services/BoardService.ts'
import { CategoryService } from '@application/services/CategoryService.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { TaskService } from '@application/services/TaskService.ts'
import {
  BoardCreateDTO,
  CategoryCreateDTO,
  EditBoardsDTO,
  EditCategoriesDTO,
  EditTasksDTO,
  EditWorkspacesDTO,
  TaskCreateDTO,
  WorkspaceCreateDTO,
} from '@application/ai/tools/toolSchemes.ts'
import { ToolCall } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { ITask } from '@entities/ITask.ts'
import { Types } from 'mongoose'
import { ICategory } from '@/domain/entities/ICategory.ts'
import { IBoard } from '@/domain/entities/IBoard.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'

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
    workspaceService: WorkspaceService
  ) {
    this.taskService = taskService
    this.categoryService = categoryService
    this.boardService = boardService
    this.workspaceService = workspaceService
  }

  public async createTasks({ toolCall, config }: BaseExternalParams): Promise<Partial<ITask>[]> {
    const args = toolCall.args as TaskCreateDTO
    const allCategoryIds: string[] = args.tasks.map((t) => t.categoryId)

    const categories = await this.categoryService.getAll(
      { ids: allCategoryIds },
      config.configurable?.user?.id
    )

    const filledTasks: Partial<ITask>[] = []

    for (const taskDTO of args.tasks) {
      const extendedTask = {
        ...taskDTO,
        categoryId: Types.ObjectId.createFromHexString(taskDTO.categoryId),
      } as Partial<ITask>

      const category = categories.find((cat) => cat.id.toString() === taskDTO.categoryId)

      if (category) {
        extendedTask.categoryName = category.name
        extendedTask.boardId = category.boardId
        extendedTask.boardName = category.boardName
        extendedTask.workspaceId = category.workspaceId
        extendedTask.workspaceName = category.workspaceName
      }

      filledTasks.push(extendedTask)
    }

    return filledTasks
  }

  public async createCategories({
    toolCall,
    config,
  }: BaseExternalParams): Promise<Partial<ICategory>[]> {
    const args = toolCall.args as CategoryCreateDTO
    const allBoardIds: string[] = args.categories.map((t) => t.boardId)

    const boards = await this.boardService.getAll(
      { ids: allBoardIds },
      config.configurable?.user?.id
    )

    const filledCategories: Partial<ICategory>[] = []

    for (const categoryDTO of args.categories) {
      const extendedCategory = {
        ...categoryDTO,
        boardId: Types.ObjectId.createFromHexString(categoryDTO.boardId),
      } as Partial<ICategory>

      const board = boards.find((b) => b.id.toString() === categoryDTO.boardId)

      if (board) {
        extendedCategory.boardName = board.name
        extendedCategory.workspaceId = board.workspaceId
        extendedCategory.workspaceName = board.workspaceName
      }

      filledCategories.push(extendedCategory)
    }

    return filledCategories
  }

  public async createBoards({ toolCall, config }: BaseExternalParams): Promise<Partial<IBoard>[]> {
    const args = toolCall.args as BoardCreateDTO
    const allWorkspaceIds: string[] = args.boards.map((t) => t.workspaceId)

    const workspaces = await this.workspaceService.getAll(
      { ids: allWorkspaceIds },
      config.configurable?.user?.id
    )

    const filledBoards: Partial<IBoard>[] = []

    for (const boardDTO of args.boards) {
      const extendedBoard = {
        ...boardDTO,
        workspaceId: Types.ObjectId.createFromHexString(boardDTO.workspaceId),
      } as Partial<IBoard>

      const workspace = workspaces.find((w) => w.id.toString() === boardDTO.workspaceId)

      if (workspace) {
        extendedBoard.workspaceName = workspace.name
      }

      filledBoards.push(extendedBoard)
    }

    return filledBoards
  }

  public async createWorkspaces({ toolCall }: BaseExternalParams): Promise<Partial<IWorkspace>[]> {
    const args = toolCall.args as WorkspaceCreateDTO

    return args.workspaces.map((ws) => ({ ...ws } as Partial<IWorkspace>))
  }

  public async editTasks({ toolCall, config }: BaseExternalParams): Promise<ITask[]> {
    const args = toolCall.args as EditTasksDTO
    const ids: string[] = args.filter.ids || []

    return this.taskService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async editCategories({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as EditCategoriesDTO
    const ids: string[] = args.filter.ids || []

    return this.categoryService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async editBoards({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as EditBoardsDTO
    const ids: string[] = args.filter.ids || []

    return this.boardService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async editWorkspaces({ toolCall, config }: BaseExternalParams) {
    const args = toolCall.args as EditWorkspacesDTO
    const ids: string[] = args.filter.ids || []

    return this.workspaceService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsTasks({ toolCall, config }: BaseExternalParams): Promise<ITask[]> {
    const ids: string[] = toolCall.args?.ids || []

    return this.taskService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsCategories({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.categoryService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsBoards({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.boardService.getAll({ ids }, config.configurable?.user?.id)
  }

  public async getByArgsIdsWorkspaces({ toolCall, config }: BaseExternalParams) {
    const ids: string[] = toolCall.args?.ids || []

    return this.workspaceService.getAll({ ids }, config.configurable?.user?.id)
  }
}
