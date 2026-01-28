import { ToolCall, ToolMessage } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { VectorSearchService } from '@/application/services/VectorSearchService.ts'
import { AgentRoles } from '@/enums/AgentRoles.ts'
import { createTools } from '../helpers/toolsHelper.ts'
import { TaskToolAdapter } from '../tools/TaskToolAdapter.ts'
import { CategoryToolAdapter } from '../tools/CategoryToolAdapter.ts'
import { BoardToolAdapter } from '../tools/BoardToolAdapter.ts'
import { WorkspaceToolAdapter } from '../tools/WorkspaceToolAdapter.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import z from 'zod'
import { BaseToolAdapter } from '../tools/BaseToolAdapter.ts'
import { IActionResponse } from '../interfaces/IActionsResponse.ts'
import { cleanArgsByCancelled } from '../helpers/cleanArgsByCancelled.ts'

export class ToolExecutorService {
  protected vectorSearchService: VectorSearchService
  protected taskToolAdapter: TaskToolAdapter
  protected categoryToolAdapter: CategoryToolAdapter
  protected boardToolAdapter: BoardToolAdapter
  protected workspaceToolAdapter: WorkspaceToolAdapter
  protected operationLogService: OperationLogService

  public tools: DynamicStructuredTool[]
  public toolsByName: Record<string, DynamicStructuredTool>
  public toolsWithOperationLogByName: Record<string, DynamicStructuredTool>
  public toolsWithUpdatedArgsByName: Record<string, DynamicStructuredTool>
  public toolsWithActionsByName: Record<string, DynamicStructuredTool>
  public hotTools: DynamicStructuredTool[]
  public plannerTools: DynamicStructuredTool[]

  constructor(
    vectorSearchService: VectorSearchService,
    operationLogService: OperationLogService,
    baseToolAdapter: BaseToolAdapter,
    taskToolAdapter: TaskToolAdapter,
    categoryToolAdapter: CategoryToolAdapter,
    boardToolAdapter: BoardToolAdapter,
    workspaceToolAdapter: WorkspaceToolAdapter,
  ) {
    this.vectorSearchService = vectorSearchService
    this.taskToolAdapter = taskToolAdapter
    this.categoryToolAdapter = categoryToolAdapter
    this.boardToolAdapter = boardToolAdapter
    this.workspaceToolAdapter = workspaceToolAdapter
    this.operationLogService = operationLogService

    const tools = createTools(
      baseToolAdapter,
      this.taskToolAdapter,
      this.boardToolAdapter,
      this.categoryToolAdapter,
      this.workspaceToolAdapter,
    )

    this.tools = tools.entityTools
    this.toolsByName = tools.toolsByName
    this.toolsWithOperationLogByName = tools.toolsWithOperationLogByName
    this.toolsWithUpdatedArgsByName = tools.toolsWithUpdatedArgsByName
    this.toolsWithActionsByName = tools.toolsWithActionsByName
    this.hotTools = tools.hotTools
    this.plannerTools = tools.plannerTools
  }

  public async getRelevantTools(steps: Array<{ description: string }>) {
    await dispatchCustomEvent(AgentRoles.TOOLS_RETRIEVING, null)

    const toolsFound = await this.vectorSearchService.similaritySearchTools(steps)
    const finalNames = toolsFound.map((tool) => tool.name)

    // Фильтруем только реально существующие
    let relevantNames = this.tools
      .filter((tool) => finalNames.includes(tool.name))
      .map((tool) => tool.name)

    if (relevantNames.length === 0) {
      relevantNames = this.hotTools.map((t) => t.name)
    }

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

    if (!tool) {
      return new ToolMessage({
        content: `Tool "${functionName}" not found.`,
        name: toolCall.name,
        tool_call_id: toolCall.id || '',
      })
    }

    const functionSchema = tool.schema as z.ZodType

    const cleanedArgs = cleanArgsByCancelled(toolCall, cancelledEntityIds)

    functionSchema.parse(cleanedArgs) as Record<string, any>

    const observation: any = await tool.invoke(cleanedArgs, { context: { cancelledEntityIds } })

    if (tool.name === 'showEntitiesToUser') {
      let parsedObservation: any = observation
      const actions: IActionResponse = {}

      if (toolCall.args.type === 'task') {
        actions.list = {
          tasks: parsedObservation,
        }
      } else if (toolCall.args.type === 'category') {
        actions.list = {
          categories: parsedObservation,
        }
      } else if (toolCall.args.type === 'board') {
        actions.list = {
          boards: parsedObservation,
        }
      } else if (toolCall.args.type === 'workspace') {
        actions.list = {
          workspaces: parsedObservation,
        }
      }

      await dispatchCustomEvent(AgentRoles.ACTIONS, {
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
      await dispatchCustomEvent(AgentRoles.UNDO, result)

      return new ToolMessage({
        content: 'Operations undone successfully.',
        tool_call_id: toolCall.id || '',
        name: toolCall.name,
      })
    }

    if (this.toolsWithActionsByName[functionName]) {
      await dispatchCustomEvent(AgentRoles.ACTIONS, result)
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
  }
}
