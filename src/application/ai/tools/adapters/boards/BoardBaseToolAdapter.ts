import { LangGraphRunnableConfig } from '@langchain/langgraph'
import IToolResult from '@/application/interfaces/IToolResult.ts'
import { FailedToolResult } from '@application/ai/tools/FailedToolResult.ts'
import { SuccessToolResult } from '@application/ai/tools/SuccessToolResult.ts'
import { Types } from 'mongoose'
import * as Sentry from '@sentry/node'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { validateInputByScheme } from '@/utils/validateInputByScheme.ts'
import { BoardCreateDTO, BoardCreateSchema } from '../../schemes/create/boardCreateSchema.ts'
import { getCompressedBoards } from '@/utils/getCompressedBoards.ts'
import { IUser } from '@/domain/entities/IUser.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import { BaseToolAdapter } from '../BaseToolAdapter.ts'

export class BoardBaseToolAdapter extends BaseToolAdapter {
  public async searchRelevantBoards(
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

      const compressedBoards = getCompressedBoards(populatedBoards)

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

      const extendedBoards = await this._extendBoardCreateDTOWithContext(
        boards,
        errors,
        user,
        configurable,
      )

      const validationSchemaMessages = validateInputByScheme(dto, BoardCreateSchema)

      errors.push(...validationSchemaMessages)

      if (errors.length > 0) {
        return new FailedToolResult(
          'There are some errors in create Boards schema:\n' +
            errors.join('\n') +
            '\nPlease correct it and try again.',
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

  private async _extendBoardCreateDTOWithContext(
    boards: BoardCreateDTO['boards'],
    errors: string[],
    user: IUser,
    configurable: Configurable,
  ): Promise<BoardDTO[]> {
    const extendedBoards: BoardDTO[] = []

    for (const board of boards) {
      const workspaceId = board.workspaceId
        ? board.workspaceId
        : await this._resolveWorkspaceByName(
            'Board',
            configurable,
            errors,
            user,
            board.workspaceName,
          )
      if (!workspaceId) continue

      const boardExtended: BoardDTO = {
        ...board,
        workspaceId: workspaceId,
      }

      extendedBoards.push(boardExtended)
    }

    return extendedBoards
  }
}
