import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { FilterQuery, Types } from 'mongoose'
import { ConfirmationEntityToolResult } from '../tools/helpers/ConfirmationEntityToolResult.ts'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.ts'
import { toServerCaseKeys } from '@/utils/objectTransformers.ts'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.ts'
import z from 'zod'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { IResponseWithLog } from '@/application/interfaces/IResponseWithLog.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { AbstractToolExecutor } from './AbstractToolExecutor.ts'
import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { IBoardRawString } from '@/domain/entities/IBoardRaw copy.ts'
import BoardRepository from '@/application/repositories/BoardRepository.ts'
import { CreateBoardsDTO, CreateBoardsDTOSchema } from '../dtos/CreateBoardsDTO.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import { UpdateBoardsDTO, UpdateBoardsDTOSchema } from '../dtos/UpdateBoardsDTO.ts'
import { BoardEditManyDTO } from '@/application/dtos/BoardEditManyDTO.ts'
import { BoardEditDTO } from '@/application/dtos/BoardEditDTO.ts'

type IBoardCreatePopulated = Partial<Omit<IBoardPopulated, 'id' | 'createdAt' | 'updatedAt'>> & {
  id: string
}

export class BoardToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private boardRepository: BoardRepository,

    private boardService: BoardService,
    private workspaceService: WorkspaceService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
  ) {
    super()

    this.toolRegistry = {
      search_boards: this.searchBoards.bind(this),
      create_boards: this.createBoards.bind(this),
      update_boards: this.updateBoards.bind(this),
    }
  }

  public async searchBoards(
    _id: string,
    args: {
      mongo_filter?: FilterQuery<IBoardRawString>
      search_query?: string
      limit?: number
    },
    userId: string,
  ) {
    const HARD_SEARCH_LIMIT = 2000

    const { mongo_filter = {}, search_query = '', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const baseFilter: FilterQuery<IBoardRawString> = {
      is_deleted: { $ne: true },
      is_deleted_external: { $ne: true },
    }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.boardRepository.getCountByFilter(unionFilter)

    const boards = await this.boardRepository.findByFilter<IBoardRawString>(
      unionFilter,
      undefined,
      {
        isMongoCase: true,
        limit: scaledLimit,
      },
    )

    if (search_query) {
      if (boards.length === 0) {
        return {
          boards: [],
          count: 0,
          hasMore: false,
        }
      }

      const fuse = new Fuse(boards, {
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
        boards: pagedResults,
        count: searchResults.length,
        hasMore: searchResults.length > scaledLimit,
      }
    }

    const hasMore = filteredCount > boards.length

    return {
      boards,
      count: filteredCount,
      hasMore,
    }
  }

  private async _populateBoardsParentData(
    boards: CreateBoardsDTO['boards'],
    userId: string,
  ): Promise<IBoardCreatePopulated[]> {
    const uniqueWorkspaceIds = Array.from(
      new Set(boards.filter((board) => board.workspace).map((board) => board.workspace)),
    )

    const workspaces = await this.workspaceService.getByCriteria(
      { ids: uniqueWorkspaceIds },
      new Types.ObjectId(userId),
    )

    return boards.map((board) => {
      const workspace = workspaces.find((w) => w.id.toString() === board.workspace)

      return {
        ...toServerCaseKeys(board),
        id: board.id,
        workspace: {
          id: workspace!.id,
          name: workspace!.name,
        },
      }
    })
  }

  private _transformRawCreateToDTO(
    boardsRaw: IBoardCreatePopulated[],
    userId: string,
  ): (BoardDTO & { id: string })[] {
    return boardsRaw.map((board) => {
      return {
        id: board.id,
        name: board.name!,
        order: board.order,
        userId: new Types.ObjectId(userId),
        workspaceId: board.workspace!.id.toString(),
        isFavorite: board.isFavorite || false,
      }
    })
  }

  private _transformRawUpdateToDTO(boardsRaw: UpdateBoardsDTO['updates']): BoardEditManyDTO {
    return boardsRaw.map((board) => {
      const update: BoardEditDTO = {
        id: board._id,
      }

      if (typeof board.name !== 'undefined') update.name = board.name
      if (typeof board.order !== 'undefined') update.order = Math.min(board.order, 1)
      if (typeof board.workspace !== 'undefined') update.workspaceId = board.workspace
      if (typeof board.is_favorite !== 'undefined') update.isFavorite = board.is_favorite

      return update
    })
  }

  public async createBoards(
    id: string,
    args: CreateBoardsDTO,
    _userId: string,
    config: Record<string, any>,
  ) {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = CreateBoardsDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const populatedBoards = await this._populateBoardsParentData(args.boards, user.id.toString())

    let dtoBoards = this._transformRawCreateToDTO(populatedBoards, user.id.toString())

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
          return new SuccessToolResult('Board creation cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoBoards = dtoBoards.filter((board) => selectedIds.includes(board.id))
        } else {
          return new FailedToolResult('Board creation pending user confirmation.')
        }
      } else {
        const mockCreateBoards = await this.boardService.createMany(
          dtoBoards,
          user,
          undefined,
          true,
        )

        if (mockCreateBoards.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: id,
            logId: mockCreateBoards.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board creation.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Создаю доски',
      },
      config,
    )

    const createdBoards = await this.boardService.createMany(dtoBoards, user)

    const logs = await this.operationLogService.getByCriteria(
      { id: createdBoards.logId!.toString() },
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

    return new SuccessToolResult(`Successfully created ${createdBoards.data.length} boards.`)
  }

  public async updateBoards(
    id: string,
    args: UpdateBoardsDTO,
    _userId: string,
    config: Record<string, any>,
  ) {
    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = UpdateBoardsDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    let dtoBoards = this._transformRawUpdateToDTO(args.updates)

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
          return new SuccessToolResult('Board update cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoBoards = dtoBoards.filter((board) => selectedIds.includes(board.id))
        }
      } else {
        const mockUpdateBoards = await this.boardService.editMany(dtoBoards, user, undefined, true)

        if (mockUpdateBoards.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: id,
            logId: mockUpdateBoards.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board update.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Обновляю доски',
      },
      config,
    )

    const updatedBoards = (await this.boardService.editMany(dtoBoards, user)) as IResponseWithLog<
      IBoardPopulated[]
    >
    const logs = await this.operationLogService.getByCriteria(
      { id: updatedBoards.logId!.toString() },
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

    return new SuccessToolResult(`Successfully updated ${updatedBoards.data.length} boards.`)
  }
}
