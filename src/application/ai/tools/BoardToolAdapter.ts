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
import { Types } from 'mongoose'
import { BoardCommandAdapterService } from '@application/ai/services/BoardCommandAdapterService.ts'
import { FilterToMongoQueryService } from '@application/ai/services/FilterToMongoQueryService.ts'
import { WorkspaceService } from '@application/services/WorkspaceService.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { validateInputBySchema } from '@/utils/validateInputBySchema.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'

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
    workspaceService: WorkspaceService,
  ) {
    this.vectorSearchService = vectorSearchService
    this.boardService = boardService
    this.boardCommandAdapterService = boardCommandAdapterService
    this.boardService = boardService
    this.filterToMongoQueryService = filterToMongoQueryService
    this.workspaceService = workspaceService
  }

  private _compressBoards(boards: IBoardPopulated[]): Array<CompressedBoard> {
    return boards.map((board) => ({
      id: board.id.toString(),
      name: board.name,
      workspaceName: board.workspace.name,
    }))
  }

  // [Tool 1]
  public async findBoardsByFilter(
    dto: BoardFilterDTO,
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const timezone = configurable.timezone || 'Europe/Moscow'

    try {
      const errorMsgs = validateInputBySchema(dto, BoardFilterSchema)

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

      const boards = await this.boardService.getByFilter(mongoFilter, undefined, undefined, 30)

      if (boards.length === 0) {
        const boardName = getFilterNameField(mongoFilter)

        if (boardName) {
          // If no boards found but filter includes 'name', try semantic search as fallback
          const semanticSearchResults = await this.vectorSearchService.similaritySearchBoards(
            [boardName],
            user.id,
            5,
          )

          const populatedSemanticResults = await this.boardService.getByFilter({
            id: { $in: semanticSearchResults.map((board) => board.id) },
          })

          const compressedSemanticResults = this._compressBoards(populatedSemanticResults)

          if (semanticSearchResults.length === 0) {
            return `No boards found matching the filter or semantically similar to the name "${boardName}".`
          }

          return (
            `No exact matches found. Here are some boards that might be relevant based on the name "${boardName}":\n` +
            JSON.stringify(compressedSemanticResults)
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
    dto: { namesToFind: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<string> {
    try {
      const { namesToFind } = dto
      const configurable = config.configurable as Configurable

      if (!namesToFind || namesToFind.length === 0) {
        return 'Board names required to find relevant boards.'
      }

      const userId = configurable.user.id

      const boards = await this.vectorSearchService.similaritySearchBoards(namesToFind, userId, 30)
      const populatedBoards = await this.boardService.getByCriteria(
        { ids: boards.map((b) => b.id.toString()) },
        userId,
      )

      const compressedBoards = this._compressBoards(populatedBoards)

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
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const boards = dto.boards

      if (!boards || boards.length === 0) {
        return new FailedToolResult('No boards provided for creation.')
      }

      const errors: string[] = []

      await this._checkWorkspacesExist(boards, errors, user.id)
      const validationSchemaMessages = validateInputBySchema(dto, BoardCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Boards schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const boardsResult = await this.boardService.createMany(boards, user)

      if (!boardsResult) {
        return new FailedToolResult('Boards creation failed.')
      }

      if (boardsResult.data && boardsResult.data.length === 0) {
        return new FailedToolResult('No boards were created.')
      } else if (!boardsResult.data) {
        return new FailedToolResult('Boards creation failed.')
      }

      return new SuccessToolResult({
        data: boardsResult.data.map((board) => ({ id: board.id, name: board.name })),
        logId: boardsResult.logId,
        actions: {
          create: {
            boards: boardsResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error creating boards: ${(e as Error).message}`)
    }
  }

  public async editBoards(
    dto: EditBoardsDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const workspaceIdValidationMessage = dto.changes.workspaceId
        ? await this._validateWorkspaceId(dto.changes.workspaceId, user.id)
        : ''

      if (workspaceIdValidationMessage) {
        return new FailedToolResult(workspaceIdValidationMessage)
      }

      const errors: string[] = []

      const validationSchemaMessages = validateInputBySchema(dto, EditBoardsSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Boards schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.boardCommandAdapterService.translateAndExecute(
        dto.filter.ids,
        dto.changes,
        user,
      )

      // Get only changed columns to return
      const changedColumns = Object.keys(dto.changes)

      const dataWithChangedColumns = editResult.data.map((task) => {
        const taskWithChangedColumns: any = { id: task.id, name: task.name }

        for (const column of changedColumns) {
          taskWithChangedColumns[column] = (task as any)[column]
        }

        return taskWithChangedColumns
      })

      return new SuccessToolResult({
        data: dataWithChangedColumns,
        logId: editResult.logId,
        actions: {
          edit: {
            boards: editResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error editing boards: ${(e as Error).message}`)
    }
  }

  public async archiveBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
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
            '\nPlease correct it and try again.',
        )
      }

      const archiveResult = await this.boardService.archive({ ids }, user)

      if (!archiveResult) {
        return new FailedToolResult('Boards archiving failed.')
      }

      if (archiveResult.data && archiveResult.data.length === 0) {
        return new FailedToolResult('No boards were archived.')
      } else if (!archiveResult.data) {
        return new FailedToolResult('Boards archiving failed.')
      }

      return new SuccessToolResult({
        data: archiveResult.data.map((board) => board.id),
        logId: archiveResult.logId,
        actions: {
          archive: {
            boards: archiveResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error archiving boards: ${(e as Error).message}`)
    }
  }

  public async cloneBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user
    const ids = dto.ids

    try {
      if (!ids || ids.length === 0) {
        return new FailedToolResult('No boards provided for cloning.')
      }

      const errors: string[] = []

      for (const id of ids) {
        if (!Types.ObjectId.isValid(id)) {
          errors.push(`Invalid Id: ${id}`)
        }
      }

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors while cloning boards:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const cloneResult = await this.boardService.clone({ ids }, user)

      if (!cloneResult) {
        return new FailedToolResult('Boards cloning failed.')
      }

      if (cloneResult.data && cloneResult.data.length === 0) {
        return new FailedToolResult('No boards were cloned.')
      } else if (!cloneResult.data) {
        return new FailedToolResult('Boards cloning failed.')
      }

      return new SuccessToolResult({
        data: cloneResult.data.map((board) => board.id),
        logId: cloneResult.logId,
        actions: {
          clone: {
            boards: cloneResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error cloning boards: ${(e as Error).message}`)
    }
  }

  public async deleteBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
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
            '\nPlease correct it and try again.',
        )
      }

      const boardsToDelete = await this.boardService.getByCriteria({ ids }, user.id)

      await this.boardService.delete({ ids }, user)

      return new SuccessToolResult({
        data: boardsToDelete.map((board) => board.id),
        actions: {
          delete: {
            boards: boardsToDelete,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error deleting boards: ${(e as Error).message}`)
    }
  }

  public async recoverBoards(
    dto: { ids: string[] },
    config: LangGraphRunnableConfig,
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
            '\nPlease correct it and try again.',
        )
      }

      const recoverResult = await this.boardService.recover({ ids }, user)

      if (!recoverResult) {
        return new FailedToolResult('Boards recovering failed.')
      }

      if (recoverResult.data && recoverResult.data.length === 0) {
        return new FailedToolResult('No boards were recovered.')
      } else if (!recoverResult.data) {
        return new FailedToolResult('Boards recovering failed.')
      }

      return new SuccessToolResult({
        data: recoverResult.data.map((board) => board.id),
        logId: recoverResult.logId,
        actions: {
          recover: {
            boards: recoverResult.data,
          },
        },
      })
    } catch (e) {
      Sentry.captureException(e)

      return new FailedToolResult(`Error recovering boards: ${(e as Error).message}`)
    }
  }

  private async _checkWorkspacesExist(
    boards: BoardCreateDTO['boards'],
    errors: string[],
    userId: Types.ObjectId,
  ): Promise<void> {
    const workspaceIdsSet = new Set<string>()

    for (const board of boards) {
      workspaceIdsSet.add(board.workspaceId)
    }

    const workspaceIds = Array.from(workspaceIdsSet)

    const existingWorkspaces = await this.workspaceService.getByCriteria(
      { ids: workspaceIds },
      userId,
    )

    const existingWorkspacesMap = new Map<string, IWorkspace>()

    for (const workspace of existingWorkspaces) {
      existingWorkspacesMap.set(workspace.id.toString(), workspace)
    }

    for (const board of boards) {
      const workspace = existingWorkspacesMap.get(board.workspaceId)

      if (!workspace) {
        errors.push(`Workspace with ID ${board.workspaceId} not found.`)

        continue
      }
    }
  }

  private async _validateWorkspaceId(workspaceId: string, userId: Types.ObjectId): Promise<string> {
    const workspaceCount = await this.workspaceService.getCount({ id: workspaceId }, userId)

    if (workspaceCount === 0) {
      return `Workspace with ID ${workspaceId} not found.`
    }

    return ''
  }
}
