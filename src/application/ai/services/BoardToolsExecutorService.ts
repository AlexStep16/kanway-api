import BoardRepository from '@/application/repositories/BoardRepository.js'
import { BoardService } from '@/application/services/BoardService.js'
import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import { ToolStatusLogLifecycleService } from './ToolStatusLogLifecycleService.js'
import { SearchBoardsDTO } from '../tools/schemes/BoardManager/SearchBoardsScheme.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { ClientSession, Types } from 'mongoose'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { Configurable } from '../interfaces/Configurable.js'
import { ISearchEntitiesContent } from '@/application/interfaces/statuses/content/ISearchEntitiesContent.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import { UpdateBoardsDTO } from '../tools/schemes/BoardManager/UpdateBoardsScheme.js'
import { IBoard } from '@/domain/entities/IBoard.js'
import {
  transformRawUpdateToDTO,
  transformRawUpdateToHumanReadableFilters,
} from '../tools/helpers/UpdateBoardsHelpers.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ConfirmationToolResult } from '../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { MoveBoardsDTO } from '../tools/schemes/BoardManager/MoveBoardsScheme.js'
import { DeleteArchiveBoardsDTO } from '../tools/schemes/BoardManager/DeleteArchiveBoardsScheme.js'
import { CloneBoardsDTO } from '../tools/schemes/BoardManager/CloneBoardsScheme.js'
import { RecoverBoardsDTO } from '../tools/schemes/BoardManager/RecoverBoardsScheme.js'
import { getSearchHumanReadableFilter } from '../tools/helpers/SearchTasksHumanReadableFilters.js'
import { SearchFilter } from '@/application/types/SearchFilter.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'
import { CreateBoardsDTO } from '../tools/schemes/BoardManager/CreateBoardsScheme.js'
import { BoardDTO } from '@/application/dtos/BoardDTO.js'
import { ReorderBoardsDTO } from '../tools/schemes/BoardManager/ReorderBoardsScheme.js'

export class BoardToolsExecutorService {
  constructor(
    private boardRepository: BoardRepository,

    private boardService: BoardService,
    private workspaceService: WorkspaceService,
    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
    private toolStatusLogLifecycleService = new ToolStatusLogLifecycleService(),
  ) {}

  public async searchBoards(
    payload: SearchBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const toolCall = context.toolCall!
    const configurable = config.configurable as Configurable
    const { filters, fields_to_include = [] } = payload

    const mongoQuery = await this.filterToMongoQueryService.prepare(
      filters,
      configurable.timezone,
      configurable.user.id,
      { entityType: 'board' },
    )
    const humanReadableFilters = this._transformSearchFiltersToHumanReadableFilters(filters)

    const toolContent: ISearchEntitiesContent = {
      filters: humanReadableFilters,
    }
    const statusLog: StatusLog = {
      id: new Types.ObjectId().toString(),
      type: StatusTypesEnum.TOOL,
      state: StatusStatesEnum.IN_PROGRESS,
      content: {
        id: toolCall.id!,
        name: 'search_boards',
        content: toolContent,
      },
    }
    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, statusLog)

    try {
      const boards = await this.boardService.getByFilter(mongoQuery, session)
      const boardsSample = buildEntitySamples(EntityTypesEnum.BOARD, boards, {
        timezone: configurable.timezone,
        additionalFields: fields_to_include,
      })
      const selection = await this.selectionService.create(
        {
          entityType: EntityTypesEnum.BOARD,
          entityIds: boards.map((b) => b.id),
          humanReadableFilters,
          sample: boardsSample,
          count: boards.length,
        },
        configurable.user.id,
        session,
      )

      statusLog.state = StatusStatesEnum.COMPLETED
      toolContent.ids = boards.map((b) => b.id.toString())

      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      return new SuccessToolResult(
        JSON.stringify({
          selection_id: selection.id.toString(),
          sample: boardsSample,
          count: boards.length,
          human_readable_filters: humanReadableFilters,
        }),
        {
          selections: [selection],
        },
      )
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async updateBoards(
    payload: UpdateBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const boardIds = await this._resolveBoardIds(payload, configurable.user.id, session)
    const toolCall = context.toolCall!

    const humanReadableUpdates = transformRawUpdateToHumanReadableFilters(payload.updates)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'update_boards',
      toolContent: {
        count: boardIds.length,
        filters: humanReadableUpdates,
      },
    })

    try {
      const boards = await this.boardRepository.findByFilter<IBoard>(
        {
          _id: { $in: boardIds },
          user_id: configurable.user.id,
        },
        session,
        {
          limit: boardIds.length,
        },
      )

      const dtoBoards = transformRawUpdateToDTO(boards, payload.updates)

      if (dtoBoards.length === 0) {
        throw new Error('No boards to update')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Board update operation was rejected by the user.')
        }
      }

      const updateBoardsResult = await this.boardService.editMany(
        dtoBoards,
        configurable.user,
        session,
        isDryRun,
      )

      if (updateBoardsResult.logId) {
        const operationLogId = updateBoardsResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully updated ${updateBoardsResult.data.length} boards. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for boards update.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async createBoards(
    payload: CreateBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'create_boards',
      toolContent: {
        count: payload.boards.length,
      },
    })

    try {
      const dtoBoards: BoardDTO[] = payload.boards.map((board) => ({
        name: board.name,
        workspaceId: board.workspace_id,
        isFavorite: board.is_favorite,
      }))

      if (dtoBoards.length === 0) {
        throw new Error('No boards to create')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Board create operation was rejected by the user.')
        }
      }

      const createBoardsResult = await this.boardService.createMany(
        dtoBoards,
        configurable.user,
        session,
        isDryRun,
      )

      if (createBoardsResult.logId) {
        const operationLogId = createBoardsResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.count = createBoardsResult.data.length
          content.logId = operationLogId
        })

        const createdSamples = createBoardsResult.data.map((board) => ({
          id: board.id.toString(),
          name: board.name,
        }))

        return new SuccessToolResult(
          `Successfully created boards: ${JSON.stringify(createdSamples)}. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for boards create.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private async _resolveBoardIds(
    payload: {
      selection_id?: string
      board_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<string[]> {
    let boardIds: string[] = []

    if (!payload.board_ids && !payload.selection_id) {
      throw new Error('Either board_ids or selection_id must be provided')
    }

    if (payload.selection_id) {
      const selections = await this.selectionService.getByCriteria(
        {
          id: payload.selection_id,
        },
        userId,
        session,
      )

      if (selections.length === 0) {
        throw new Error('Selection not found')
      }

      const selection = selections[0]

      boardIds = selection.entityIds.map((id) => id.toString())
    }

    if (payload.board_ids) {
      payload.board_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid board id: ${id}`)
        }
      })

      boardIds = Array.from(new Set(payload.board_ids))
    }

    if (boardIds.length === 0) {
      throw new Error('No boards to update')
    }

    return boardIds
  }

  private async _resolveHumanReadableFilters(
    payload: {
      selection_id?: string
      board_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    if (payload.selection_id) {
      const selections = await this.selectionService.getByCriteria(
        {
          id: payload.selection_id,
        },
        userId,
        session,
      )

      if (selections.length === 0) {
        throw new Error('Selection not found')
      }

      const selection = selections[0]

      return selection.humanReadableFilters
    }

    if (payload.board_ids) {
      payload.board_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid board id: ${id}`)
        }
      })

      const boards = await this.boardService.getByCriteria(
        { ids: payload.board_ids },
        userId,
        session,
      )

      return boards.map((board) => ({
        text: 'Название',
        value: board.name,
      }))
    }

    return []
  }

  private async _resolveMoveHumanReadableFilters(
    payload: MoveBoardsDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    const filters: ITextValue[] = []

    if (payload.toStart) {
      filters.push({
        text: 'Позиция',
        value: 'в начало',
      })
    }

    if (payload.toEnd) {
      filters.push({
        text: 'Позиция',
        value: 'в конец',
      })
    }

    const anchorBoardIds = Array.from(
      new Set([payload.beforeBoardId, payload.afterBoardId].filter(Boolean) as string[]),
    )
    const anchorBoardNamesById = new Map<string, string>()

    if (anchorBoardIds.length > 0) {
      const anchorBoards = await this.boardService.getByCriteria(
        { ids: anchorBoardIds },
        userId,
        session,
      )

      anchorBoards.forEach((board) => {
        anchorBoardNamesById.set(board.id.toString(), board.name)
      })
    }

    if (payload.beforeBoardId) {
      filters.push({
        text: 'Перед доской',
        value: anchorBoardNamesById.get(payload.beforeBoardId) ?? payload.beforeBoardId,
      })
    }

    if (payload.afterBoardId) {
      filters.push({
        text: 'После доски',
        value: anchorBoardNamesById.get(payload.afterBoardId) ?? payload.afterBoardId,
      })
    }

    if (payload.newWorkspaceId) {
      const workspaces = await this.workspaceService.getByCriteria(
        { id: payload.newWorkspaceId },
        userId,
        session,
      )

      filters.push({
        text: 'Новое пространство',
        value: workspaces[0]?.name ?? payload.newWorkspaceId,
      })
    }

    return filters
  }

  private async _resolveReorderHumanReadableFilters(
    payload: ReorderBoardsDTO,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ITextValue[]> {
    const filters: ITextValue[] = []
    const newNames: string[] = []

    if (payload.board_ids && payload.board_ids.length > 0) {
      const boards = await this.boardService.getByCriteria(
        { ids: payload.board_ids },
        userId,
        session,
      )

      boards.forEach((board) => {
        newNames.push(board.name)
      })
    }

    filters.push({
      text: 'Новый порядок досок',
      value: newNames.join(', '),
    })

    return filters
  }

  public async deleteArchiveBoards(
    payload: DeleteArchiveBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const boardIds = await this._resolveBoardIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const mainFunction = payload.soft_delete
      ? this.boardService.archive.bind(this.boardService)
      : this.boardService.delete.bind(this.boardService)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'delete_archive_boards',
      toolContent: {
        count: boardIds.length,
        filters: humanReadableFilters,
        isSoftDelete: payload.soft_delete,
      },
    })

    const actionString = payload.soft_delete ? 'archived' : 'deleted'

    let isDryRun = false

    try {
      if (
        [AiConfirmationTypeEnum.ALWAYS, AiConfirmationTypeEnum.ONLY_FOR_SENSITIVE].includes(
          configurable.aiConfirmationType,
        )
      ) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult(
            `Board ${actionString} operation was rejected by the user. The user decided not to proceed with ${actionString}. Do not attempt to ${actionString} the boards again.`,
          )
        }
      }

      const result = await mainFunction(
        {
          ids: boardIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (result.logId) {
        const operationLogId = result.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        let boardsProcessedCount = 0

        if (result.data && typeof result.data === 'object' && 'deletedCount' in result.data) {
          const deletedCount = (result.data as { deletedCount?: unknown }).deletedCount
          boardsProcessedCount = typeof deletedCount === 'number' ? deletedCount : 0
        } else if (result.data && Array.isArray(result.data)) {
          boardsProcessedCount = result.data.length
        } else if (result.data === null && !payload.soft_delete) {
          boardsProcessedCount = boardIds.length
        } else {
          return new FailedToolResult(`No boards were ${actionString} by the operation.`)
        }

        return new SuccessToolResult(
          `Successfully ${actionString} ${boardsProcessedCount} boards. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult(`Failed to create operation log for boards ${actionString}.`)
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async cloneBoards(
    payload: CloneBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const boardIds = await this._resolveBoardIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'clone_boards',
      toolContent: {
        count: boardIds.length,
        filters: humanReadableFilters,
      },
    })

    try {
      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Board clone operation was rejected by the user.')
        }
      }

      const cloneBoardsResult = await this.boardService.clone(
        {
          ids: boardIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (cloneBoardsResult.logId) {
        const operationLogId = cloneBoardsResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully cloned ${cloneBoardsResult.data.length} boards. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for boards clone.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async recoverBoards(
    payload: RecoverBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const boardIds = await this._resolveBoardIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'recover_boards',
      toolContent: {
        count: boardIds.length,
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Board recover operation was rejected by the user.')
        }
      }

      const recoverBoardsResult = await this.boardService.recover(
        {
          ids: boardIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (recoverBoardsResult.logId) {
        const operationLogId = recoverBoardsResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully recovered ${recoverBoardsResult.data.length} boards. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for boards recover.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async moveBoards(
    payload: MoveBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const boardIds = await this._resolveBoardIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveMoveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'move_boards',
      toolContent: {
        count: boardIds.length,
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Board move operation was rejected by the user.')
        }
      }

      const moveBoardsResult = await this.boardService.moveMany(
        {
          ids: boardIds,
          beforeBoardId: payload.beforeBoardId,
          afterBoardId: payload.afterBoardId,
          toStart: payload.toStart,
          toEnd: payload.toEnd,
          newWorkspaceId: payload.newWorkspaceId,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (moveBoardsResult.logId) {
        const operationLogId = moveBoardsResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully moved ${moveBoardsResult.data.length} boards. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for boards move.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async reorderBoards(
    payload: ReorderBoardsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const boardIds = await this._resolveBoardIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveReorderHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'reorder_boards',
      toolContent: {
        count: boardIds.length,
        filters: humanReadableFilters,
      },
    })

    let isDryRun = false

    try {
      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Board reorder operation was rejected by the user.')
        }
      }

      const reorderBoardsResult = await this.boardService.reorder(
        {
          ids: boardIds,
          workspaceId: payload.workspace_id,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (reorderBoardsResult.logId) {
        const operationLogId = reorderBoardsResult.logId.toString()

        if (isDryRun) {
          await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog, (content) => {
            content.logId = operationLogId
          })

          return new ConfirmationToolResult({
            logId: operationLogId,
          })
        }

        await dispatchCustomEvent(CustomEvents.OPERATION, {
          logId: operationLogId,
          session,
        })

        await this.toolStatusLogLifecycleService.setCompleted(statusLog, (content) => {
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully reordered ${reorderBoardsResult.data.length} boards. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for boards reorder.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private _transformSearchFiltersToHumanReadableFilters(filters: SearchFilter[]): ITextValue[] {
    return filters
      .map((filter) => {
        try {
          return getSearchHumanReadableFilter(filter)
        } catch (error) {
          console.error(
            `Error transforming filter to human-readable format: ${error instanceof Error ? error.message : error}`,
          )
          return null
        }
      })
      .filter((filter): filter is ITextValue => filter !== null)
  }
}
