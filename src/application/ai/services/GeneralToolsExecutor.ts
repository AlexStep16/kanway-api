import { CategoryService } from '@/application/services/CategoryService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Types } from 'mongoose'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { AbstractToolExecutor } from './AbstractToolExecutor.ts'
import { DispatchPayload } from './ToolDispatcherService.ts'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.ts'
import { Configurable } from '../interfaces/Configurable.ts'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.ts'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.ts'
import { ChatMessageService } from '@/application/services/ChatMessageService.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { ConfirmationEntityToolResult } from '../tools/helpers/ConfirmationEntityToolResult.ts'

export class GeneralToolsExecutor extends AbstractToolExecutor {
  constructor(
    private taskService: TaskService,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private workspaceService: WorkspaceService,
    private chatMessageService: ChatMessageService,
    private operationLogService: OperationLogService,
  ) {
    super()

    this.toolRegistry = {
      display_to_user: this.displayToUser.bind(this),
      undo_operation: this.undoOperation.bind(this),
    }
  }

  public async displayToUser(payload: DispatchPayload) {
    const { toolCall, config, tempToRealIdMap } = payload
    const { view_type, ids } = toolCall.args as { view_type: string; ids: string[] }
    const userId = new Types.ObjectId(payload.userId)

    const mappedIds = ids.map((id) => tempToRealIdMap[id] || id)
    const criteria = { ids: mappedIds }

    const serviceMap: Record<string, any> = {
      task: this.taskService,
      category: this.categoryService,
      board: this.boardService,
      workspace: this.workspaceService,
    }

    const service = serviceMap[view_type]

    if (!service) {
      return new FailedToolResult(`Unsupported view_type: ${view_type}`)
    }

    const result = await service.getByCriteria(criteria, userId)

    dispatchCustomEvent(CustomEvents.DISPLAY, { entityType: view_type, entities: result }, config)

    return new SuccessToolResult(`Displayed ${result.length} ${view_type}(s) to the user.`)
  }

  public async undoOperation(payload: DispatchPayload) {
    const { toolCall, config } = payload

    const logId = toolCall.args?.log_id
    const toolCallId = toolCall.id

    const configurable = config.configurable as Configurable
    const user = configurable.user

    if (!logId || typeof logId !== 'string') {
      return new FailedToolResult('Invalid or missing argument: log_id must be a string.')
    }

    if (configurable.aiConfirmationType === AiConfirmationTypeEnum.ALWAYS) {
      const messages = await this.chatMessageService.getByCriteria(
        { pendingToolCallId: toolCallId, role: 'operation' },
        user.id,
      )

      if (messages.length > 0) {
        const logs = await this.operationLogService.getByCriteria(
          { id: messages[0].content },
          user.id,
        )

        const log = logs[0]

        if (log.status === OperationLogStatusesEnum.CANCELLED) {
          return new SuccessToolResult('Undo operation cancelled by user.')
        }
      } else {
        const mockOperationsUndo = await this.operationLogService.undoOperations(
          [logId],
          user,
          undefined,
          true,
        )
        const mockOperationUndo = mockOperationsUndo[0]

        if (mockOperationUndo.logId) {
          return new ConfirmationEntityToolResult({
            toolCallId: toolCallId,
            logId: mockOperationUndo.logId.toString(),
          })
        } else return new FailedToolResult('Failed to create operation log for undo operation.')
      }
    }

    await dispatchCustomEvent(
      CustomEvents.STEP_ADD,
      {
        id: new Types.ObjectId().toString(),
        name: 'Отменяю операцию',
      },
      config,
    )

    const operationsUndo = await this.operationLogService.undoOperations([logId], user, undefined)
    const logs = await this.operationLogService.getByCriteria(
      { id: operationsUndo[0].logId!.toString() },
      user.id,
    )

    await dispatchCustomEvent(
      CustomEvents.OPERATION,
      {
        logId: logs[0].id,
        toolCallId: toolCallId,
      },
      config,
    )

    return new SuccessToolResult(`Operation with log ID ${logId} has been undone.`)
  }
}
