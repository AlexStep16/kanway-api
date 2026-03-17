import { BoardService } from '@application/services/BoardService.ts'
import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '../../FailedToolResult.ts'
import { SuccessToolResult } from '../../SuccessToolResult.ts'
import { BoardCommandAdapterService } from '@/application/ai/services/BoardCommandAdapterService.ts'
import { IBoard } from '@/domain/entities/IBoard.ts'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import {
  EditBoardsNameDTO,
  EditBoardsNameSchema,
  EditBoardsOrderDTO,
  EditBoardsOrderSchema,
  FavoriteBoardsDTO,
  FavoriteBoardsSchema,
  MoveBoardsDTO,
  MoveBoardsSchema,
} from '../../schemes/update/boardEditSchemes.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'

export class BoardEditToolAdapter {
  private boardService: BoardService
  private workspaceService: WorkspaceService
  private boardCommandAdapterService: BoardCommandAdapterService

  constructor(
    boardService: BoardService,
    workspaceService: WorkspaceService,
    boardCommandAdapterService: BoardCommandAdapterService,
  ) {
    this.boardService = boardService
    this.workspaceService = workspaceService
    this.boardCommandAdapterService = boardCommandAdapterService
  }

  public async updateBoardsName(
    dto: EditBoardsNameDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditBoardsNameSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Boards name schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.boardCommandAdapterService.translateEditStringAndExecute(
        dto.filter.ids,
        dto.name,
        'name',
        user,
      )

      const dataWithChangedColumns = editResult.data.map((board) => {
        const boardWithChangedColumns: Partial<IBoard> = { id: board.id, name: board.name }

        return boardWithChangedColumns
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

      return new FailedToolResult(`Error editing boards name: ${(e as Error).message}`)
    }
  }

  public async moveBoards(
    dto: MoveBoardsDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, MoveBoardsSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in move Boards schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const workspaceCount = await this.workspaceService.getCount({ id: dto.workspaceId }, user.id)

      if (workspaceCount === 0) {
        return new FailedToolResult(`Workspace with ID ${dto.workspaceId} not found.`)
      }

      const editResult = await this.boardCommandAdapterService.translateEditWorkspaceAndExecute(
        dto.filter.ids,
        dto.workspaceId,
        user,
      )

      const dataWithChangedColumns = editResult.data.map((board) => {
        const boardWithChangedColumns: Partial<IBoardPopulated> = {
          id: board.id,
          workspace: board.workspace,
        }

        return boardWithChangedColumns
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

      return new FailedToolResult(`Error moving boards: ${(e as Error).message}`)
    }
  }

  public async updateBoardsOrder(
    dto: EditBoardsOrderDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, EditBoardsOrderSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in edit Boards order schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.boardService.edit(
        {
          order: parseInt(dto.order as any, 10),
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((board) => {
        const boardWithChangedColumns: Partial<IBoard> = {
          id: board.id,
          order: board.order,
        }

        return boardWithChangedColumns
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

      return new FailedToolResult(`Error updating boards order: ${(e as Error).message}`)
    }
  }

  public async favoriteBoards(
    dto: FavoriteBoardsDTO,
    config: LangGraphRunnableConfig,
  ): Promise<IToolResult> {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    try {
      const validationSchemaMessages = validateInputByScheme(dto, FavoriteBoardsSchema)

      if (validationSchemaMessages.length > 0) {
        return new FailedToolResult(
          'There are some errors in favorite Boards schema:\n' +
            validationSchemaMessages.join('\n') +
            '\nPlease correct it and try again.',
        )
      }

      const editResult = await this.boardService.edit(
        {
          isFavorite: !!dto.isFavorite,
        },
        {
          ids: dto.filter.ids,
        },
        user,
      )

      const dataWithChangedColumns = editResult.data.map((board) => {
        const boardWithChangedColumns: Partial<IBoard> = {
          id: board.id,
          isFavorite: board.isFavorite,
        }

        return boardWithChangedColumns
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

      return new FailedToolResult(`Error updating boards favorite status: ${(e as Error).message}`)
    }
  }
}
