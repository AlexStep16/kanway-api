import { CategoryService } from '@/application/services/CategoryService.js'
import { SelectionService } from './SelectionService.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { BoardService } from '@/application/services/BoardService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { ToolResult } from '../tools/helpers/ToolResult/ToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import { ClientSession, Types } from 'mongoose'
import { Configurable } from '../interfaces/Configurable.js'
import { IConfigContext } from '../interfaces/IConfigContext.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { ToolStatusLogLifecycleService } from './ToolStatusLogLifecycleService.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { OperationLogService } from '@/application/services/OperationLogService.js'
import { ITextValue } from '@/application/interfaces/statuses/content/ITextValue.js'
import { OperationTypesEnum } from '@/domain/enums/OperationTypesEnum.js'
import { ConfirmationToolResult } from '../tools/helpers/ToolResult/ConfirmationToolResult.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { StatusStatesEnum } from '@/enums/StatusStatesEnum.js'
import { buildEntitySamples } from '../tools/helpers/EntitySamplesHelpers.js'
import { GetSelectionDetailsDTO } from '../tools/schemes/GetSelectionDetailsScheme.js'

export class GeneralToolsExecutor {
  constructor(
    private selectionService: SelectionService,
    private taskService: TaskService,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private workspaceService: WorkspaceService,
    private operationLogService: OperationLogService,

    private toolStatusLogLifecycleService = new ToolStatusLogLifecycleService(),
  ) {}

  public async getSelectionDetails(
    payload: GetSelectionDetailsDTO,
    config: RunnableConfig,
    session?: ClientSession,
  ): Promise<ToolResult> {
    const { selection_id, fields_to_include = [] } = payload
    const configurable = config.configurable as Configurable
    const timezone = configurable.user.timezone || 'UTC'
    const userId = configurable.user.id

    const selections = await this.selectionService.getByCriteria(
      {
        id: selection_id,
      },
      userId,
      session,
    )

    if (selections.length === 0) {
      return new FailedToolResult(`Selection with id ${selection_id} not found.`)
    }

    const selection = selections[0]

    const { entityType, entityIds } = selection
    const sringifiedEntityIds = entityIds.map((id) => id.toString())

    let details: any[] = []

    switch (entityType) {
      case 'task':
        details = (
          await this.taskService.getByCriteria({ ids: sringifiedEntityIds }, userId, session)
        ).slice(0, 20) // Limit to 20 items to avoid token overload
        break
      case 'category':
        details = (
          await this.categoryService.getByCriteria({ ids: sringifiedEntityIds }, userId, session)
        ).slice(0, 20)
        break
      case 'board':
        details = (
          await this.boardService.getByCriteria({ ids: sringifiedEntityIds }, userId, session)
        ).slice(0, 20)
        break
      case 'workspace':
        details = (
          await this.workspaceService.getByCriteria({ ids: sringifiedEntityIds }, userId, session)
        ).slice(0, 20)
        break
      default:
        return new FailedToolResult(`Unsupported entity type: ${entityType}`)
    }

    const samples = buildEntitySamples(entityType, details, {
      timezone,
      limit: 20,
      additionalFields: fields_to_include,
    })

    return new SuccessToolResult(JSON.stringify(samples))
  }

  private _getOperationTypeText(operationType: OperationTypesEnum): string {
    switch (operationType) {
      case OperationTypesEnum.CREATE:
        return 'Создание'
      case OperationTypesEnum.CLONE:
        return 'Копирование'
      case OperationTypesEnum.DELETE:
        return 'Удаление'
      case OperationTypesEnum.ARCHIVE:
        return 'Архивация'
      case OperationTypesEnum.RECOVER:
        return 'Восстановление'
      case OperationTypesEnum.UPDATE:
        return 'Обновление'
      default:
        return ''
    }
  }

  private _getCollectionNameText(collectionName: string): string {
    switch (collectionName) {
      case 'tasks':
        return 'задач'
      case 'categories':
        return 'категорий'
      case 'boards':
        return 'досок'
      case 'workspaces':
        return 'пространств'
      default:
        return ''
    }
  }

  private async _getHumanReadableUndoDetails(
    logIds: string[],
    userId: Types.ObjectId,
    session?: ClientSession,
  ) {
    const filters: ITextValue[] = []
    const logs = await this.operationLogService.getByCriteria({ ids: logIds }, userId, session)

    for (const log of logs) {
      const { operationType, collectionName } = log

      const text =
        this._getOperationTypeText(operationType) +
        ' ' +
        this._getCollectionNameText(collectionName)

      filters.push({ text })
    }

    return filters
  }

  public async undoOperations(
    logIds: string[],
    config: RunnableConfig,
    context: IConfigContext,
    session?: ClientSession,
  ) {
    const configurable = config.configurable as Configurable
    const toolCall = context.toolCall!

    if (!logIds || !Array.isArray(logIds) || logIds.some((id) => typeof id !== 'string')) {
      return new FailedToolResult(
        'Invalid or missing argument: log_ids must be an array of strings.',
      )
    }
    const filters = await this._getHumanReadableUndoDetails(logIds, configurable.user.id, session)

    const statusLog = await this.toolStatusLogLifecycleService.getOrCreateInProgressLog({
      existingLog: context.statusLog,
      toolCallId: toolCall.id!,
      toolName: 'undo_operations',
      toolContent: filters,
    })

    try {
      let isDryRun = false

      if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
        if (context.isApproved === undefined) {
          isDryRun = true
        } else if (context.isApproved === false) {
          await this.toolStatusLogLifecycleService.setCancelled(statusLog)

          return new SuccessToolResult('Undo operation was rejected by the user.')
        }
      }
      console.log(isDryRun)
      const undoResult = await this.operationLogService.undoOperations(
        logIds,
        configurable.user,
        session,
        isDryRun,
      )

      if (isDryRun) {
        await this.toolStatusLogLifecycleService.setAwaitingConfirmation(statusLog)

        return new ConfirmationToolResult(null)
      }

      await dispatchCustomEvent(CustomEvents.OPERATION, {
        logId: undoResult[0].logId, // TODO: Fix it when partrial invalidation will be implemented in frontend
        session,
      })

      await this.toolStatusLogLifecycleService.setCompleted(statusLog)

      return new SuccessToolResult(`Operations with log IDs ${logIds.join(', ')} have been undone.`)
    } catch (error) {
      statusLog.state = StatusStatesEnum.FAILED
      await dispatchCustomEvent(CustomEvents.STATUS_UPDATE_LOG, statusLog)

      throw error
    }
  }
}
