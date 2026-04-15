import { CategoryService } from '@/application/services/CategoryService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { ClientSession, Types } from 'mongoose'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { BoardService } from '@/application/services/BoardService.js'
import { AbstractToolExecutor } from './AbstractToolExecutor.js'
import { DispatchPayload } from './ToolDispatcherService.js'
import { FailedToolResult } from '../tools/helpers/FailedToolResult.js'
import { Configurable } from '../interfaces/Configurable.js'
import { AiConfirmationTypeEnum } from '@/domain/enums/AiConfirmationTypeEnum.js'
import { OperationLogStatusesEnum } from '@/domain/enums/OperationLogStatusesEnum.js'
import { ChatMessageService } from '@/application/services/ChatMessageService.js'
import { OperationLogService } from '@/application/services/OperationLogService.js'
import { ConfirmationEntityToolResult } from '../tools/helpers/ConfirmationEntityToolResult.js'

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

  public async displayToUser(payload: DispatchPayload, session?: ClientSession) {
    const { toolCall, config } = payload
    const { view_type, ids } = toolCall.args as { view_type: string; ids: string[] }
    const userId = new Types.ObjectId(payload.userId)

    const mappedIds = Array.from(new Set(ids))
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

    const result = await service.getByCriteria(criteria, userId, session)

    dispatchCustomEvent(CustomEvents.DISPLAY, { entityType: view_type, entities: result }, config)

    const lightResult = result.map((item: any) => ({ id: item.id, name: item.name }))

    return new SuccessToolResult(
      `Displayed next entities to the user:\n ${JSON.stringify(lightResult)}`,
    )
  }

  public async undoOperation(payload: DispatchPayload, session?: ClientSession) {
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
          return new SuccessToolResult('Undo operation cancelled by user.')
        }
      } else {
        const mockOperationsUndo = await this.operationLogService.undoOperations(
          [logId],
          user,
          session,
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

    const operationsUndo = await this.operationLogService.undoOperations([logId], user, session)
    const logs = await this.operationLogService.getByCriteria(
      { id: operationsUndo[0].logId!.toString() },
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

    return new SuccessToolResult(`Operation with log ID ${logId} has been undone.`)
  }
}
