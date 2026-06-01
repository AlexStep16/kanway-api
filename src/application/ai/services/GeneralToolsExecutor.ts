import { CategoryService } from '@/application/services/CategoryService.js'
import { SelectionService } from './SelectionService.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { BoardService } from '@/application/services/BoardService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { ToolResult } from '../tools/helpers/ToolResult/ToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'
import { ClientSession, Types } from 'mongoose'

export class GeneralToolsExecutor {
  constructor(
    private selectionService: SelectionService,
    private taskService: TaskService,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private workspaceService: WorkspaceService,
  ) {}

  public async getSelectionDetails(
    selectionId: string,
    userId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<ToolResult> {
    const selections = await this.selectionService.getByCriteria(
      {
        id: selectionId,
      },
      userId,
      session,
    )

    if (selections.length === 0) {
      return new FailedToolResult(`Selection with id ${selectionId} not found or expired.`)
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

    return new SuccessToolResult(JSON.stringify(details))
  }
}
