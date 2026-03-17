import { ToolCall, ToolMessage } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { createTools } from '../helpers/toolsHelper.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import z from 'zod'
import { BaseToolAdapter } from '../tools/adapters/BaseToolAdapter.ts'
import { IActionResponse } from '../interfaces/IActionsResponse.ts'
import { cleanArgsByCancelled } from '../helpers/cleanArgsByCancelled.ts'
import { Types } from 'mongoose'
import { TOOLS_TIPS_MAP } from '@/constants/TOOLS_TIPS_MAP.ts'
import { TaskBaseToolAdapter } from '../tools/adapters/tasks/TaskBaseToolAdapter.ts'
import { TaskEditToolAdapter } from '../tools/adapters/tasks/TaskEditToolAdapter.ts'
import { CategoryBaseToolAdapter } from '../tools/adapters/categories/CategoryBaseToolAdapter.ts'
import { CategoryEditToolAdapter } from '../tools/adapters/categories/CategoryEditToolAdapter.ts'
import { BoardBaseToolAdapter } from '../tools/adapters/boards/BoardBaseToolAdapter.ts'
import { BoardEditToolAdapter } from '../tools/adapters/boards/BoardEditToolAdapter.ts'
import { WorkspaceBaseToolAdapter } from '../tools/adapters/workspaces/WorkspaceBaseToolAdapter.ts'
import { WorkspaceEditToolAdapter } from '../tools/adapters/workspaces/WorkspaceEditToolAdapter.ts'

export class ToolExecutorService {
  protected vectorSearchService: VectorSearchService
  protected operationLogService: OperationLogService

  public tools: DynamicStructuredTool[]
  public toolsByName: Record<string, DynamicStructuredTool>
  public toolsWithOperationLogByName: Record<string, DynamicStructuredTool>
  public toolsWithUpdatedArgsByName: Record<string, DynamicStructuredTool>
  public toolsWithActionsByName: Record<string, DynamicStructuredTool>
  public executorTools: DynamicStructuredTool[]
  public plannerTools: DynamicStructuredTool[]

  constructor(
    vectorSearchService: VectorSearchService,
    operationLogService: OperationLogService,
    baseToolAdapter: BaseToolAdapter,
    taskBaseToolAdapter: TaskBaseToolAdapter,
    taskEditToolAdapter: TaskEditToolAdapter,
    categoryBaseToolAdapter: CategoryBaseToolAdapter,
    categoryEditToolAdapter: CategoryEditToolAdapter,
    boardBaseToolAdapter: BoardBaseToolAdapter,
    boardEditToolAdapter: BoardEditToolAdapter,
    workspaceBaseToolAdapter: WorkspaceBaseToolAdapter,
    workspaceEditToolAdapter: WorkspaceEditToolAdapter,
  ) {
    this.vectorSearchService = vectorSearchService
    this.operationLogService = operationLogService

    const tools = createTools(
      baseToolAdapter,
      taskBaseToolAdapter,
      taskEditToolAdapter,
      boardBaseToolAdapter,
      boardEditToolAdapter,
      categoryBaseToolAdapter,
      categoryEditToolAdapter,
      workspaceBaseToolAdapter,
      workspaceEditToolAdapter,
    )

    this.tools = tools.entityTools
    this.toolsByName = tools.toolsByName
    this.toolsWithOperationLogByName = tools.toolsWithOperationLogByName
    this.toolsWithUpdatedArgsByName = tools.toolsWithUpdatedArgsByName
    this.toolsWithActionsByName = tools.toolsWithActionsByName
    this.executorTools = tools.executorTools
    this.plannerTools = tools.plannerTools
  }

  public async getRelevantTools(steps: Array<{ description: string }>) {
    await dispatchCustomEvent(CustomEvents.TOOLS_RETRIEVING, null)

    const toolsFound = await this.vectorSearchService.similaritySearchTools(steps)
    const finalNames = toolsFound.map((tool) => tool.name)

    const relevantNames = this.tools
      .filter((tool) => finalNames.includes(tool.name))
      .map((tool) => tool.name)

    return {
      relevantNames,
    }
  }

  public async executeTool(
    toolCall: ToolCall,
    cancelledEntityIds: string[] = [],
  ): Promise<ToolMessage> {
    const functionName = toolCall.name
    const tool: DynamicStructuredTool = this.toolsByName[functionName]
    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: TOOLS_TIPS_MAP.get(functionName) || 'Выполнение инструмента',
    })

    if (!tool) {
      return new ToolMessage({
        content: `Tool "${functionName}" not found.`,
        name: toolCall.name,
        tool_call_id: toolCall.id || '',
      })
    }

    const functionSchema = tool.schema as z.ZodType

    const cleanedArgs = cleanArgsByCancelled(toolCall, cancelledEntityIds)

    try {
      functionSchema.parse(cleanedArgs) as Record<string, any>

      const observation: any = await tool.invoke(cleanedArgs, { context: { cancelledEntityIds } })

      await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
        id: stepId.toString(),
        state: 'completed',
      })

      if (tool.name === 'showEntitiesToUser') {
        const actions: IActionResponse = {}

        if (toolCall.args.type === 'task') {
          actions.list = {
            tasks: observation,
          }
        } else if (toolCall.args.type === 'category') {
          actions.list = {
            categories: observation,
          }
        } else if (toolCall.args.type === 'board') {
          actions.list = {
            boards: observation,
          }
        } else if (toolCall.args.type === 'workspace') {
          actions.list = {
            workspaces: observation,
          }
        }

        await dispatchCustomEvent(CustomEvents.ACTIONS, {
          actions,
        })

        return new ToolMessage({
          content: 'Entities have been presented to the user.',
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      }

      const result = observation?.result

      if (!result) {
        return new ToolMessage({
          content: typeof observation === 'string' ? observation : JSON.stringify(observation),
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      }

      if (tool.name === 'undoOperations') {
        await dispatchCustomEvent(CustomEvents.UNDO, result)

        return new ToolMessage({
          content: 'Operations undone successfully.',
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      }

      if (this.toolsWithActionsByName[functionName]) {
        await dispatchCustomEvent(CustomEvents.ACTIONS, result)
      }

      if (this.toolsWithOperationLogByName[functionName]) {
        if (result.data !== undefined) {
          const content = JSON.stringify({
            result: result.data,
            logId: result.logId,
          })

          return new ToolMessage({
            content,
            tool_call_id: toolCall.id || '',
            name: toolCall.name,
          })
        }
      }

      return new ToolMessage({
        content: typeof observation === 'string' ? observation : JSON.stringify(observation),
        tool_call_id: toolCall.id || '',
        name: toolCall.name,
      })
    } catch (error: any) {
      await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
        id: stepId.toString(),
        state: 'failed',
      })

      throw error
    }
  }
}
