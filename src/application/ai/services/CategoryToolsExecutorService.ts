import ColumnRepository from '@/application/repositories/ColumnRepository.js'
import { ColumnService } from '@/application/services/ColumnService.js'
import { FilterToMongoQueryService } from './FilterToMongoQueryService.js'
import { SelectionService } from './SelectionService.js'
import { ToolStatusLogLifecycleService } from './ToolStatusLogLifecycleService.js'
import { SearchColumnsDTO } from '../tools/schemes/ColumnManager/SearchColumnsScheme.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { ClientSession, Types } from 'mongoose'
import { BoardService } from '@/application/services/BoardService.js'
import { Configurable } from '../interfaces/Configurable.js'
import { ISearchEntitiesContent } from '@/application/interfaces/statuses/content/ISearchEntitiesContent.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { StatusTypesEnum } from '@/enums/StatusTypesEnum.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { EntityTypesEnum } from '@/domain/enums/EntityTypesEnum.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import { UpdateColumnsDTO } from '../tools/schemes/ColumnManager/UpdateColumnsScheme.js'
import { IColumn } from '@/domain/entities/IColumn.js'
import {
  transformRawUpdateToDTO,
  transformRawUpdateToHumanReadableFilters,
} from '../tools/helpers/UpdateColumnsHelpers.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { ConfirmationToolResult } from '../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { MoveColumnsDTO } from '../tools/schemes/ColumnManager/MoveColumnsScheme.js'
import { DeleteArchiveColumnsDTO } from '../tools/schemes/ColumnManager/DeleteArchiveColumnsScheme.js'
import { CloneColumnsDTO } from '../tools/schemes/ColumnManager/CloneColumnsScheme.js'
import { RecoverColumnsDTO } from '../tools/schemes/ColumnManager/RecoverColumnsScheme.js'
import { SearchFilter } from '@/application/types/SearchFilter.js'
import { getSearchHumanReadableFilter } from '../tools/helpers/SearchTasksHumanReadableFilters.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'
import { CreateColumnsDTO } from '../tools/schemes/ColumnManager/CreateColumnsScheme.js'
import { ColumnDTO } from '@/application/dtos/ColumnDTO.js'

export class ColumnToolsExecutorService {
  constructor(
    private columnRepository: ColumnRepository,

    private columnService: ColumnService,
    private boardService: BoardService,
    private filterToMongoQueryService: FilterToMongoQueryService,
    private selectionService: SelectionService,
    private toolStatusLogLifecycleService = new ToolStatusLogLifecycleService(),
  ) {}

  public async searchColumns(
    payload: SearchColumnsDTO,
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
      { entityType: 'column' },
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
        name: 'search_columns',
        content: toolContent,
      },
    }
    await dispatchCustomEvent(CustomEvents.STATUS_ADD_LOG, statusLog)

    try {
      const columns = await this.columnService.getByFilter(mongoQuery, session)
      const columnsSample = buildEntitySamples(EntityTypesEnum.COLUMN, columns, {
        timezone: configurable.timezone,
        additionalFields: fields_to_include,
      })
      const selection = await this.selectionService.create(
        {
          entityType: EntityTypesEnum.COLUMN,
          entityIds: columns.map((c) => c.id),
          humanReadableFilters,
          sample: columnsSample,
          count: columns.length,
        },
        configurable.user.id,
        session,
      )

      statusLog.state = StatusStatesEnum.COMPLETED
      toolContent.ids = columns.map((c) => c.id.toString())

      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      return new SuccessToolResult(
        JSON.stringify({
          selection_id: selection.id.toString(),
          sample: columnsSample,
          count: columns.length,
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

  public async updateColumns(
    payload: UpdateColumnsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const columnIds = await this._resolveColumnIds(payload, configurable.user.id, session)
    const toolCall = context.toolCall!

    const humanReadableUpdates = transformRawUpdateToHumanReadableFilters(payload.updates)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'update_columns',
      toolContent: {
        count: columnIds.length,
        filters: humanReadableUpdates,
      },
    })

    try {
      const columns = await this.columnRepository.findByFilter<IColumn>(
        {
          _id: { $in: columnIds },
          user_id: configurable.user.id,
        },
        session,
        {
          limit: columnIds.length,
        },
      )

      const dtoColumns = transformRawUpdateToDTO(columns, payload.updates)

      if (dtoColumns.length === 0) {
        throw new Error('No columns to update')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Column update operation was rejected by the user.')
        }
      }

      const updateColumnsResult = await this.columnService.editMany(
        dtoColumns,
        configurable.user,
        session,
        isDryRun,
      )

      if (updateColumnsResult.logId) {
        const operationLogId = updateColumnsResult.logId.toString()

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
          `Successfully updated ${updateColumnsResult.data.length} columns. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for columns update.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async createColumns(
    payload: CreateColumnsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'create_columns',
      toolContent: {
        count: payload.columns.length,
      },
    })

    try {
      const dtoColumns: ColumnDTO[] = payload.columns.map((column) => ({
        name: column.name,
        boardId: column.board_id,
      }))

      if (dtoColumns.length === 0) {
        throw new Error('No columns to create')
      }

      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Column create operation was rejected by the user.')
        }
      }

      const createColumnsResult = await this.columnService.createMany(
        dtoColumns,
        configurable.user,
        session,
        isDryRun,
      )

      if (createColumnsResult.logId) {
        const operationLogId = createColumnsResult.logId.toString()

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
          content.count = createColumnsResult.data.length
          content.logId = operationLogId
        })

        return new SuccessToolResult(
          `Successfully created ${createColumnsResult.data.length} columns. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for columns create.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  private async _resolveColumnIds(
    payload: {
      selection_id?: string
      column_ids?: string[]
    },
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<string[]> {
    let columnIds: string[] = []

    if (!payload.column_ids && !payload.selection_id) {
      throw new Error('Either column_ids or selection_id must be provided')
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

      columnIds = selection.entityIds.map((id) => id.toString())
    }

    if (payload.column_ids) {
      payload.column_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid column id: ${id}`)
        }
      })

      columnIds = Array.from(new Set(payload.column_ids))
    }

    if (columnIds.length === 0) {
      throw new Error('No columns to update')
    }

    return columnIds
  }

  private async _resolveHumanReadableFilters(
    payload: {
      selection_id?: string
      column_ids?: string[]
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

    if (payload.column_ids) {
      payload.column_ids.forEach((id) => {
        if (!Types.ObjectId.isValid(id)) {
          throw new Error(`Invalid column id: ${id}`)
        }
      })

      const columns = await this.columnService.getByCriteria(
        { ids: payload.column_ids },
        userId,
        session,
      )

      return columns.map((column) => ({
        text: 'Название',
        value: column.name,
      }))
    }

    return []
  }

  private async _resolveMoveHumanReadableFilters(
    payload: MoveColumnsDTO,
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

    const anchorColumnIds = Array.from(
      new Set([payload.beforeColumnId, payload.afterColumnId].filter(Boolean) as string[]),
    )
    const anchorColumnNamesById = new Map<string, string>()

    if (anchorColumnIds.length > 0) {
      const anchorColumns = await this.columnService.getByCriteria(
        { ids: anchorColumnIds },
        userId,
        session,
      )

      anchorColumns.forEach((column) => {
        anchorColumnNamesById.set(column.id.toString(), column.name)
      })
    }

    if (payload.beforeColumnId) {
      filters.push({
        text: 'Перед категорией',
        value: anchorColumnNamesById.get(payload.beforeColumnId) ?? payload.beforeColumnId,
      })
    }

    if (payload.afterColumnId) {
      filters.push({
        text: 'После категории',
        value: anchorColumnNamesById.get(payload.afterColumnId) ?? payload.afterColumnId,
      })
    }

    if (payload.newBoardId) {
      const boards = await this.boardService.getByCriteria(
        { id: payload.newBoardId },
        userId,
        session,
      )

      filters.push({
        text: 'Новая доска',
        value: boards[0]?.name ?? payload.newBoardId,
      })
    }

    return filters
  }

  public async deleteArchiveColumns(
    payload: DeleteArchiveColumnsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const columnIds = await this._resolveColumnIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const mainFunction = payload.soft_delete
      ? this.columnService.archive.bind(this.columnService)
      : this.columnService.delete.bind(this.columnService)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'delete_archive_columns',
      toolContent: {
        count: columnIds.length,
        filters: humanReadableFilters,
        isSoftDelete: payload.soft_delete,
      },
    })

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

          return new SuccessToolResult('Column update operation was rejected by the user.')
        }
      }

      const result = await mainFunction(
        {
          ids: columnIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      const actionString = payload.soft_delete ? 'archived' : 'deleted'

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

        let columnsProcessedCount = 0

        if (result.data && 'deletedCount' in result.data) {
          columnsProcessedCount = result.data.deletedCount
        } else if (result.data && Array.isArray(result.data)) {
          columnsProcessedCount = result.data.length
        } else {
          return new FailedToolResult('No columns were affected by the operation.')
        }

        return new SuccessToolResult(
          `Successfully ${actionString} ${columnsProcessedCount} columns. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult(`Failed to create operation log for columns ${actionString}.`)
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async cloneColumns(
    payload: CloneColumnsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const columnIds = await this._resolveColumnIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'clone_columns',
      toolContent: {
        count: columnIds.length,
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

          return new SuccessToolResult('Column clone operation was rejected by the user.')
        }
      }

      const cloneColumnsResult = await this.columnService.clone(
        {
          ids: columnIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (cloneColumnsResult.logId) {
        const operationLogId = cloneColumnsResult.logId.toString()

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
          `Successfully cloned ${cloneColumnsResult.data.length} columns. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for columns clone.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async recoverColumns(
    payload: RecoverColumnsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const columnIds = await this._resolveColumnIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'recover_columns',
      toolContent: {
        count: columnIds.length,
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

          return new SuccessToolResult('Column recover operation was rejected by the user.')
        }
      }

      const recoverColumnsResult = await this.columnService.recover(
        {
          ids: columnIds,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (recoverColumnsResult.logId) {
        const operationLogId = recoverColumnsResult.logId.toString()

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
          `Successfully recovered ${recoverColumnsResult.data.length} columns. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for columns recover.')
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }

  public async moveColumns(
    payload: MoveColumnsDTO,
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const columnIds = await this._resolveColumnIds(payload, configurable.user.id, session)
    const humanReadableFilters = await this._resolveMoveHumanReadableFilters(
      payload,
      configurable.user.id,
      session,
    )
    const toolCall = context.toolCall!

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'move_columns',
      toolContent: {
        count: columnIds.length,
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

          return new SuccessToolResult('Column move operation was rejected by the user.')
        }
      }

      const moveColumnsResult = await this.columnService.moveMany(
        {
          ids: columnIds,
          beforeColumnId: payload.beforeColumnId,
          afterColumnId: payload.afterColumnId,
          toStart: payload.toStart,
          toEnd: payload.toEnd,
          newBoardId: payload.newBoardId,
        },
        configurable.user,
        session,
        isDryRun,
      )

      if (moveColumnsResult.logId) {
        const operationLogId = moveColumnsResult.logId.toString()

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
          `Successfully moved ${moveColumnsResult.data.length} columns. Operation Log ID: ${operationLogId}`,
          {
            logId: operationLogId,
          },
        )
      }

      return new FailedToolResult('Failed to create operation log for columns move.')
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
