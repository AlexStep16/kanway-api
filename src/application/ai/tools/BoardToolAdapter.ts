import { BoardService } from '@application/services/BoardService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import {
  BoardFilterDTO,
  BoardFilterSchema,
  BoardCreateDTO,
  BoardCreateSchema,
  EditBoardsDTO,
  EditBoardsSchema,
} from './toolSchemes.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import { getFilterNameField } from '../helpers/getFilterNameField.ts'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '@application/ai/tools/FailedToolResult.ts'
import { SuccessToolResult } from '@application/ai/tools/SuccessToolResult.ts'
import { BoardDTO } from '@application/dtos/BoardDTO.ts'
import { Types } from 'mongoose'
import { BoardCommandAdapterService } from '@application/ai/services/BoardCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@application/ai/services/FilterToMongoQueryService.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import { IUndoResponse } from '@/application/interfaces/IUndoResponse.ts'
import { IBoardsWithChildrenResponse } from '@/application/interfaces/IBoardsWithChildrenResponse.ts'
import { IBoard } from '@/domain/entities/IBoard.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'

interface CompressedBoard {
  id: string
  name: string
  workspaceName?: string
}

export class BoardToolAdapter {
  private vectorSearchService: VectorSearchService
  private boardService: BoardService
  private boardCommandAdapterService: BoardCommandAdapterService
  private filterToMongoQueryService: FilterToMongoQueryService
  private workspaceService: WorkspaceService

  constructor(
    vectorSearchService: VectorSearchService,
    boardService: BoardService,
    boardCommandAdapterService: BoardCommandAdapterService,
    filterToMongoQueryService: FilterToMongoQueryService,
    workspaceService: WorkspaceService
  ) {
    this.vectorSearchService = vectorSearchService
    this.boardService = boardService
    this.boardCommandAdapterService = boardCommandAdapterService
    this.boardService = boardService
    this.filterToMongoQueryService = filterToMongoQueryService
    this.workspaceService = workspaceService
  }

  private _compressBoards(boards: IBoard[]): Array<CompressedBoard> {
    return boards.map((board) => ({
      id: board.id.toString(),
      name: board.name,
      workspaceName: board.workspaceName,
    }))
  }

  // [Tool 1]
  public async findBoardsByFilter(
    dto: BoardFilterDTO,
    config: LangGraphRunnableConfig
  ): Promise<string> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = this.baseService.validateInputBySchema(dto, BoardFilterSchema)

      if (errorMsgs.length > 0) {
        return (
          'Filter validation error:\n' + errorMsgs + '\nPlease correct the filter and try again.'
        )
      }

      let mongoFilter = await this.filterToMongoQueryService.prepare(
        dto,
        timezone,
        user.id,
        configurable.activeWorkspaceId
      )

      if (Object.keys(mongoFilter).length === 0) return JSON.stringify([])

      const boards = await this.boardService.getByFilter(mongoFilter, user.id, 30)

      if (boards.length === 0) {
        const boardName = getFilterNameField(mongoFilter)

        if (boardName) {
          // If no boards found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.baseService.similaritySearchBoards(
            boardName,
            user.id,
            2
          )

          if (semanticSearchResults.length === 0) {
            return `No boards found matching the filter or semantically similar to the name "${boardName}".`
          }

          return (
            `No exact matches found. Here are some boards that might be relevant based on the name "${boardName}":\n` +
            JSON.stringify(semanticSearchResults)
          )
        }
      }

      const compressedBoards = this._compressBoards(boards)

      if (compressedBoards.length === 0) {
        return 'No boards found matching the provided filter.'
      } else if (compressedBoards.length > 20) {
        return `Found ${compressedBoards.length} boards. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedBoards)
    } catch (e) {
      Sentry.captureException(e)

      return `Error retrieving boards: ${(e as Error).message}`
    }
  }

  public async findRelevantBoards(
    findRelevantDto: { nameToFind: string },
    config: LangGraphRunnableConfig
  ): Promise<string> {
    try {
      const { nameToFind } = findRelevantDto
      const configurable = config.configurable as Configurable

      if (!nameToFind) {
        return 'Board name required to find relevant boards.'
      }

      const userId = configurable.user.id

      const boards = await this.baseService.similaritySearchBoards(nameToFind, userId, 30)

      const compressedBoards = this._compressBoards(boards)

      if (compressedBoards.length === 0) {
        return 'No boards found matching the provided filter.'
      } else if (compressedBoards.length > 20) {
        return `Found ${compressedBoards.length} boards. Please refine your filter to narrow down the results.`
      }

      return JSON.stringify(compressedBoards)
    } catch (e) {
      Sentry.captureException(e)

      return `Error finding relevant boards: ${(e as Error).message}`
    }
  }

  public async createBoards(
    dto: BoardCreateDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const threadId = configurable.thread_id

    try {
      const boards = dto.boards

      if (!boards || boards.length === 0) {
        return new FailedToolResult('No boards provided for creation.')
      }

      const errors: string[] = []

      const extendedBoards = await this._extendBoardCreateDTOWithContext(
        boards,
        errors,
        user.id,
        threadId
      )

      const validationSchemaMessages = this.baseService.validateInputBySchema(
        dto,
        BoardCreateSchema
      )

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Boards schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const boardsResult = await this.boardService.createMany(extendedBoards, user)

      if (!boardsResult) {
        return new FailedToolResult('Boards creation failed.')
      }

      if (boardsResult.data && boardsResult.data.length === 0) {
        return new FailedToolResult('No boards were created.')
      } else if (!boardsResult.data) {
        return new FailedToolResult('Boards creation failed.')
      }

      const integration: IUndoResponse<IBoardsWithChildrenResponse> = {
        update: {
          boards: boardsResult.data,
          categories: [],
          tasks: [],
        },
      }

      const dataWithIntegration = {
        data: boardsResult.data.map((board) => ({ id: board.id, name: board.name })),
        logId: boardsResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating boards: ${(e as Error).message}`)
    }
  }

  public async editBoards(
    dto: EditBoardsDTO,
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const threadId = configurable.thread_id

    try {
      const workspaceIdValidationMessage = dto.changes.workspaceId
        ? await this._validateWorkspaceId(dto.changes.workspaceId, user.id)
        : ''

      if (workspaceIdValidationMessage) {
        return new FailedToolResult(workspaceIdValidationMessage)
      }

      const errors: string[] = []

      const validationSchemaMessages = this.baseService.validateInputBySchema(dto, EditBoardsSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Boards schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const editResult = await this.boardCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        user,
        undefined,
        threadId
      )

      const integration: IUndoResponse<IBoardsWithChildrenResponse> = {
        update: {
          boards: editResult.data,
          categories: [],
          tasks: [],
        },
      }

      // Get only changed columns to return
      const changedColumns = Object.keys(dto.changes)

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: any = { id: task.id, name: task.name }

        for (const column of changedColumns) {
          taskWithChangedColumns[column] = (task as any)[column]
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

      return new FailedToolResult(`Error editing boards: ${(e as Error).message}`)
    }
  }

  public async archiveBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No boards provided for archiving.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while archiving boards:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const archiveResult = await this.boardService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Boards archiving failed.')
      }

      if (
        archiveResult.data &&
        archiveResult.data.boards &&
        archiveResult.data.boards.length === 0
      ) {
        return new FailedToolResult('No boards were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Boards archiving failed.')
      }

      const integration: IUndoResponse<IBoardsWithChildrenResponse> = {
        update: {
          boards: archiveResult.data.boards,
          categories: archiveResult.data.categories,
          tasks: archiveResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        data: archiveResult.data.boards.map((board) => board.id),
        logId: archiveResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving boards: ${(e as Error).message}`)
    }
  }

  public async deleteBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No boards provided for deletion.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while deleting boards:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const deleteResult = await this.boardService.delete({ ids }, user)

      if (!deleteResult) {
        return new FailedToolResult('Boards deletion failed.')
      }

      const deletedIds: unknown = ids.map((id) => ({ id }))

      const integration: IUndoResponse<IBoardsWithChildrenResponse> = {
        update: {
          boards: deleteResult,
          categories: [],
          tasks: [],
        },
        delete: {
          boards: deletedIds as IBoard[],
          categories: [],
          tasks: [],
        },
      }

      const dataWithIntegration = {
        data: deleteResult.map((board) => board.id),
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting boards: ${(e as Error).message}`)
    }
  }

  public async recoverBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No boards provided for recovering.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while recovering boards:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.'
        )
      }

      const recoverResult = await this.boardService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Boards recovering failed.')
      }

      if (
        recoverResult.data &&
        recoverResult.data.boards &&
        recoverResult.data.boards.length === 0
      ) {
        return new FailedToolResult('No boards were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Boards recovering failed.')
      }

      const integration: IUndoResponse<IBoardsWithChildrenResponse> = {
        update: {
          boards: recoverResult.data.boards,
          categories: recoverResult.data.categories,
          tasks: recoverResult.data.tasks,
        },
      }

      const dataWithIntegration = {
        data: recoverResult.data.boards.map((board) => board.id),
        logId: recoverResult.logId,
        integration,
      }

      return new SuccessToolResult(dataWithIntegration)
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering boards: ${(e as Error).message}`)
    }
  }

  private async _extendBoardCreateDTOWithContext(
    boards: BoardCreateDTO['boards'],
    errors: string[],
    userId: Types.ObjectId,
    threadId?: string
  ): Promise<BoardDTO[]> {
    const extendedBoards: BoardDTO[] = []

    for (const board of boards) {
      const workspace = await this.workspaceService.getById(board.workspaceId, userId)

      if (!workspace) {
        errors.push(`Workspace with ID ${board.workspaceId} not found.`)

        continue
      }

      const boardExtended: BoardDTO = {
        ...board,
        workspaceId: workspace.id.toString(),
        workspaceName: workspace.name,
      }

      if (threadId) {
        boardExtended.threadId = threadId
      }

      extendedBoards.push(boardExtended)
    }

    return extendedBoards
  }

  private async _validateWorkspaceId(workspaceId: string, userId: Types.ObjectId): Promise<string> {
    const workspace = await this.workspaceService.getById(workspaceId, userId)

    if (!workspace) {
      return `Workspace with ID ${workspaceId} not found.`
    }

    return ''
  }
}
