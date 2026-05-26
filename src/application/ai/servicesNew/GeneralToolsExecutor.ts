import { CategoryService } from '@/application/services/CategoryService.js'
import { SelectionService } from './SelectionService.js'
import { WorkspaceService } from '@/application/services/WorkspaceService.js'
import { BoardService } from '@/application/services/BoardService.js'
import { TaskService } from '@/application/services/TaskService.js'
import { ToolResult } from '../tools/helpers/ToolResult/ToolResult.js'
import { FailedToolResult } from '../tools/helpers/ToolResult/FailedToolResult.js'
import { SuccessToolResult } from '../tools/helpers/ToolResult/SuccessToolResult.js'

export class GeneralToolsExecutor {
  constructor(
    private selectionService: SelectionService,
    private taskService: TaskService,
    private categoryService: CategoryService,
    private boardService: BoardService,
    private workspaceService: WorkspaceService,
  ) {}

  public async getSelectionDetails(selectionId: string): Promise<ToolResult> {
    const selection = await this.selectionService.getSelection(selectionId)
    if (!selection) {
      return new FailedToolResult(`Selection with id ${selectionId} not found or expired.`)
    }

    const { entityType, entityIds } = selection

    let details: any[] = []

    switch (entityType) {
      case 'task':
        details = (await this.taskService.getByCriteria({ ids: entityIds })).slice(0, 20) // Limit to 20 items to avoid token overload
        break
      case 'category':
        details = (await this.categoryService.getByCriteria({ ids: entityIds })).slice(0, 20)
        break
      case 'board':
        details = (await this.boardService.getByCriteria({ ids: entityIds })).slice(0, 20)
        break
      case 'workspace':
        details = (await this.workspaceService.getByCriteria({ ids: entityIds })).slice(0, 20)
        break
      default:
        return new FailedToolResult(`Unsupported entity type: ${entityType}`)
    }

    return new SuccessToolResult(JSON.stringify(details))
  }
}
