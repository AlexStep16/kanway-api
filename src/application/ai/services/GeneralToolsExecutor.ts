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

export class GeneralToolsExecutor extends AbstractToolExecutor {
  constructor(
    private taskService: TaskService,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private workspaceService: WorkspaceService,
  ) {
    super()
    this.toolRegistry = {
      display_to_user: this.displayToUser.bind(this),
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
}
