import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import Fuse from 'fuse.js'
import { ClientSession, FilterQuery, Types } from 'mongoose'
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
import { IBoardRawString } from '@/domain/entities/IBoardRawString.ts'
import BoardRepository from '@/application/repositories/BoardRepository.ts'
import { CreateBoardsDTO, CreateBoardsDTOSchema } from '../dtos/CreateBoardsDTO.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { BoardDTO } from '@/application/dtos/BoardDTO.ts'
import { UpdateBoardsDTO, UpdateBoardsDTOSchema } from '../dtos/UpdateBoardsDTO.ts'
import { BoardEditManyDTO } from '@/application/dtos/BoardEditManyDTO.ts'
import { BoardEditDTO } from '@/application/dtos/BoardEditDTO.ts'
import { MoveBoardDTO, MoveBoardDTOSchema } from '../dtos/MoveBoardDTO.ts'
import { BoardMoveDTO } from '@/application/dtos/BoardMoveDTO.ts'
import { DispatchPayload } from './ToolDispatcherService.ts'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { findProperty } from '@/utils/findProperty.ts'

type IBoardCreatePopulated = Omit<IBoardPopulated, 'id' | 'createdAt' | 'updatedAt'> & {
  id: string
}

export class BoardToolsExecutorService extends AbstractToolExecutor {
  constructor(
    private boardRepository: BoardRepository,

    private boardService: BoardService,
    private workspaceService: WorkspaceService,
    private operationLogService: OperationLogService,
    private chatMessageService: ChatMessageService,
    private vectorSearchService: VectorSearchService,
  ) {
    super()

    this.toolRegistry = {
      search_boards: this.searchBoards.bind(this),
      create_boards: this.createBoards.bind(this),
      update_boards: this.updateBoards.bind(this),
      move_board: this.moveBoard.bind(this),
      delete_boards: this.deleteBoards.bind(this),
      archive_boards: this.archiveBoards.bind(this),
      recover_boards: this.recoverBoards.bind(this),
      clone_boards: this.cloneBoards.bind(this),
    }
  }

  public async searchBoards(payload: DispatchPayload, session?: ClientSession) {
    const HARD_SEARCH_LIMIT = 2000

    const { toolCall, userId } = payload

    const args = toolCall.args as {
      mongo_filter?: FilterQuery<IBoardRawString>
      search_query?: string
      search_mode?: 'fuzzy' | 'semantic'
      limit?: number
    }

    const { mongo_filter = {}, search_query = '', search_mode = 'fuzzy', limit = 50 } = args

    const scaledLimit = search_query ? HARD_SEARCH_LIMIT : limit

    const isMongoFilterHasDeletedCondition =
      findProperty(mongo_filter, 'is_deleted') !== undefined ||
      findProperty(mongo_filter, 'is_deleted_external') !== undefined

    const baseFilter: FilterQuery<IBoardRawString> = isMongoFilterHasDeletedCondition
      ? {}
      : {
          is_deleted: { $ne: true },
          is_deleted_external: { $ne: true },
        }

    const unionFilter = { ...baseFilter, ...mongo_filter, user_id: new Types.ObjectId(userId) }

    const filteredCount = await this.boardRepository.getCountByFilter(unionFilter, session)

    const boards = await this.boardRepository.findByFilter<IBoardRawString>(unionFilter, session, {
      isMongoCase: true,
      limit: scaledLimit,
      sort: { rank: 1 },
    })

    if (search_query) {
      if (boards.length === 0) {
        return {
          items: [],
          count: 0,
          hasMore: false,
        }
      }

      let pagedResults: IBoardRawString[] = []
      let searchedCount = 0

      if (search_mode === 'fuzzy') {
        const fuse = new Fuse(boards, {
          keys: ['name'],
          threshold: 0.3,
          includeScore: true,
        })

        const searchResults = fuse.search(search_query)

        pagedResults = searchResults
          .sort((a, b) => (a.score || 0) - (b.score || 0))
          .slice(0, scaledLimit)
          .map((result) => result.item)
        searchedCount = searchResults.length
      } else if (search_mode === 'semantic') {
        const filteredIds = boards.map((board) => new Types.ObjectId(board._id))

        const semanticBoards = await this.vectorSearchService.similaritySearchBoards(
          [search_query],
          new Types.ObjectId(userId),
          20,
          filteredIds,
        )
        const semanticBoardIds = semanticBoards.map((board) => board.id.toString())

        pagedResults = boards.filter((board) => semanticBoardIds.includes(board._id.toString()))
        searchedCount = semanticBoards.length
      }

      return {
        items: pagedResults,
        count: searchedCount,
        hasMore: searchedCount > scaledLimit,
      }
    }

    const hasMore = filteredCount > boards.length

    return {
      items: boards,
      count: filteredCount,
      hasMore,
    }
  }

  private async _populateBoardsParentData(
    boards: CreateBoardsDTO['boards'],
    userId: string,
    session?: ClientSession,
  ): Promise<IBoardCreatePopulated[]> {
    const uniqueWorkspaceIds = Array.from(
      new Set(boards.filter((board) => board.workspace).map((board) => board.workspace)),
    )

    const workspaces = await this.workspaceService.getByCriteria(
      { ids: uniqueWorkspaceIds },
      new Types.ObjectId(userId),
      session,
    )

    return boards.map((board) => {
      const workspace = workspaces.find((w) => w.id.toString() === board.workspace)

      if (!workspace) {
        throw new Error(`Workspace with ID ${board.workspace} not found for board ${board.name}`)
      }

      return {
        ...toServerCaseKeys(board),
        id: board._id,
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
      }
    })
  }

  private _transformRawCreateToDTO(
    boardsRaw: IBoardCreatePopulated[],
  ): (BoardDTO & { id: string })[] {
    return boardsRaw.map((board) => {
      return {
        id: board.id,
        name: board.name,
        workspaceId: board.workspace.id.toString(),
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
      if (typeof board.workspace !== 'undefined') update.workspaceId = board.workspace
      if (typeof board.is_favorite !== 'undefined') update.isFavorite = board.is_favorite

      return update
    })
  }

  public async createBoards(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as CreateBoardsDTO
    const toolCallId = toolCall.id

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

    const populatedBoards = await this._populateBoardsParentData(
      args.boards,
      user.id.toString(),
      session,
    )

    let dtoBoards = this._transformRawCreateToDTO(populatedBoards)

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
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
        const mockCreateBoards = await this.boardService.createMany(dtoBoards, user, session, true)

        if (mockCreateBoards.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
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

    const createdBoards = await this.boardService.createMany(dtoBoards, user, session)

    const logs = await this.operationLogService.getByCriteria(
      { id: createdBoards.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = createdBoards.data.map((board) => ({
      id: board.id,
      name: board.name,
    }))

    const resultMessage = `
      Successfully created ${createdBoards.data.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${createdBoards.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async updateBoards(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as UpdateBoardsDTO
    const toolCallId = toolCall.id

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
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Board update cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          dtoBoards = dtoBoards.filter((board) => selectedIds.includes(board.id))
        }
      } else {
        const mockUpdateBoards = await this.boardService.editMany(dtoBoards, user, session, true)

        if (mockUpdateBoards.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
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

    const updatedBoards = (await this.boardService.editMany(
      dtoBoards,
      user,
      session,
    )) as IResponseWithLog<IBoardPopulated[]>
    const logs = await this.operationLogService.getByCriteria(
      { id: updatedBoards.logId!.toString() },
      user.id,
      session,
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

    const resultMessage = `
      Successfully updated ${updatedBoards.data.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${updatedBoards.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async moveBoard(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const args = toolCall.args as MoveBoardDTO
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    const validationResult = MoveBoardDTOSchema.safeParse(args)

    if (!validationResult.success) {
      return new FailedToolResult(
        `Validation Error: Invalid arguments. \n${z.prettifyError(
          validationResult.error,
        )}. \nPlease fix the arguments and try again.`,
      )
    }

    const dto: BoardMoveDTO = {
      id: args.id,
      beforeId: args.before_id ? args.before_id : undefined,
      afterId: args.after_id ? args.after_id : undefined,
      newWorkspaceId: args.new_workspace_id ? args.new_workspace_id : undefined,
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Board move cancelled by user.')
        }
      } else {
        const mockMoveBoard = await this.boardService.move(dto, user, session, true)

        if (mockMoveBoard.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockMoveBoard.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board move.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Перемещаю доски',
      },
      config,
    )

    const result = await this.boardService.move(dto, user, session)

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
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

    const resultMessage = `
      Successfully moved ${result.data.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${result.logId}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async deleteBoards(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Board delete cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockDeleteBoard = await this.boardService.delete(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockDeleteBoard.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockDeleteBoard.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board delete.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Удаляю доски',
      },
      config,
    )

    const result = await this.boardService.delete(
      {
        ids: args.ids,
      },
      user,
      session,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesBefore || []).map((board) => ({
      id: board.id,
      name: board.name,
    }))

    const resultMessage = `
      Successfully deleted ${resultInfo.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${logs[0].id}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async archiveBoards(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Boards archive cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockArchiveBoard = await this.boardService.archive(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockArchiveBoard.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockArchiveBoard.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board archive.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Архивирую доски',
      },
      config,
    )

    const result = await this.boardService.archive(
      {
        ids: args.ids,
      },
      user,
      session,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((board) => ({
      id: board.id,
      name: board.name,
    }))

    const resultMessage = `
      Successfully archived ${result.data.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${logs[0].id}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async recoverBoards(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Boards recovery cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockRecoverBoard = await this.boardService.recover(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
        )

        if (mockRecoverBoard.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockRecoverBoard.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board recovery.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Восстанавливаю доски',
      },
      config,
    )

    const result = await this.boardService.recover(
      {
        ids: args.ids,
      },
      user,
      session,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((board) => ({
      id: board.id,
      name: board.name,
    }))

    const resultMessage = `
      Successfully recovered ${result.data.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${logs[0].id}
    `

    return new SuccessToolResult(resultMessage)
  }

  public async cloneBoards(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload

    const args = toolCall.args as { ids: string[]; tempIds: string[] }
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!args.ids || !Array.isArray(args.ids) || args.ids.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Validation Error: Invalid arguments. Please provide an object with an ids property which is array of string IDs.',
      )
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
        session,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
          session,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Boards clone cancelled by user.')
        } else if (log.status === OperationLogStatusesEnum.APPROVED) {
          const selectedIds = log.selectedIds || []

          args.ids = args.ids.filter((id) => selectedIds.includes(id))
        }
      } else {
        const mockCloneBoard = await this.boardService.clone(
          {
            ids: args.ids,
          },
          user,
          session,
          true,
          args.tempIds,
        )

        if (mockCloneBoard.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockCloneBoard.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for board clone.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Копирую доски',
      },
      config,
    )

    const result = await this.boardService.clone(
      {
        ids: args.ids,
      },
      user,
      session,
      true,
      args.tempIds,
    )

    const logs = await this.operationLogService.getByCriteria(
      { id: result.logId!.toString() },
      user.id,
      session,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    const resultInfo = (logs[0].entitiesAfter || []).map((board) => ({
      id: board.id,
      name: board.name,
    }))

    const resultMessage = `
      Successfully cloned ${result.data.length} boards: ${JSON.stringify(resultInfo)}
      Log ID: ${logs[0].id}
    `

    return new SuccessToolResult(resultMessage)
  }
}
