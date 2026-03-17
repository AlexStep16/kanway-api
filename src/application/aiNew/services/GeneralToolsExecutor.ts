import { CategoryService } from '@/application/services/CategoryService.ts'
import { TaskService } from '@/application/services/TaskService.ts'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Types } from 'mongoose'
import { SuccessToolResult } from '../tools/helpers/SuccessToolResult.ts'
import { WorkspaceService } from '@/application/services/WorkspaceService.ts'
import { BoardService } from '@/application/services/BoardService.ts'
import { AbstractToolExecutor } from './AbstractToolExecutor.ts'

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

  public async displayToUser(
    _id: string,
    args: { view_type: string; ids: string[]; title?: string },
    userId: string,
    config: Record<string, any>,
  ) {
    const { view_type, ids } = args

    switch (view_type) {
      case 'task': {
        const result = await this.taskService.getByCriteria({ ids }, new Types.ObjectId(userId))

        return dispatchCustomEvent(
          CustomEvents.DISPLAY,
          { entityType: 'task', entities: result },
          config,
        )
      }
      case 'category': {
        const result = await this.categoryService.getByCriteria({ ids }, new Types.ObjectId(userId))

        return dispatchCustomEvent(
          CustomEvents.DISPLAY,
          { entityType: 'category', entities: result },
          config,
        )
      }
      case 'board': {
        const result = await this.boardService.getByCriteria({ ids }, new Types.ObjectId(userId))

        return dispatchCustomEvent(
          CustomEvents.DISPLAY,
          { entityType: 'board', entities: result },
          config,
        )
      }
      case 'workspace': {
        const result = await this.workspaceService.getByCriteria(
          { ids },
          new Types.ObjectId(userId),
        )

        return dispatchCustomEvent(
          CustomEvents.DISPLAY,
          { entityType: 'workspace', entities: result },
          config,
        )
      }
    }

    return new SuccessToolResult('Data has been displayed.')
  }
}
