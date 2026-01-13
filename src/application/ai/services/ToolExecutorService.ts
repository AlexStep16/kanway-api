import { BaseMessage, ToolCall, ToolMessage } from '@langchain/core/messages'
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
import { IUser } from '@/domain/entities/IUser.ts'
import z from 'zod'
import { BaseToolAdapter } from '../tools/BaseToolAdapter.ts'
import { ShowEntitiesToUserDTO } from '../tools/toolSchemes.ts'
import * as Sentry from '@sentry/node'

export class ToolExecutorService {
  protected vectorSearchService: VectorSearchService
  protected taskToolAdapter: TaskToolAdapter
  protected categoryToolAdapter: CategoryToolAdapter
  protected boardToolAdapter: BoardToolAdapter
  protected workspaceToolAdapter: WorkspaceToolAdapter
  protected operationLogService: OperationLogService
  public tools: DynamicStructuredTool[]
  public toolsByName: Record<string, DynamicStructuredTool>
  public toolsWithIntegrationByName: Record<string, DynamicStructuredTool>
  public hotTools: DynamicStructuredTool[]
  public plannerTools: DynamicStructuredTool[]

  constructor(
    vectorSearchService: VectorSearchService,
    operationLogService: OperationLogService,
    baseToolAdapter: BaseToolAdapter,
    taskToolAdapter: TaskToolAdapter,
    categoryToolAdapter: CategoryToolAdapter,
    boardToolAdapter: BoardToolAdapter,
    workspaceToolAdapter: WorkspaceToolAdapter
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
      this.workspaceToolAdapter
    )

    this.tools = tools.entityTools
    this.toolsByName = tools.toolsByName
    this.toolsWithIntegrationByName = tools.toolsWithIntegrationByName
    this.hotTools = tools.hotTools
    this.plannerTools = tools.plannerTools
  }

  public async getRelevantTools(steps: Array<{ description: string }>) {
    await dispatchCustomEvent(AgentRoles.TOOLS_RETRIEVING, null)

    const toolsFound = await this.baseService.similaritySearchTools(steps)
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

  public async executeTool(toolCall: ToolCall, _: BaseMessage[], user: IUser) {
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

    const data = functionSchema.parse(toolCall.args)

    const observation: any = await tool.invoke(data)

    if (tool.name === 'showEntitiesToUser') {
      let parsedObservation: any = {}

      try {
        parsedObservation = JSON.parse(observation)

        await dispatchCustomEvent(AgentRoles.LIST_ENTITIES, {
          entities: parsedObservation,
          type: (data as ShowEntitiesToUserDTO).type,
        })
      } catch (error) {
        Sentry.captureException(new Error('Failed to parse showEntitiesToUser: ' + observation), {
          extra: {
            observation,
            error,
          },
        })
      }

      return new ToolMessage({
        content: 'Entities have been presented to the user.',
        tool_call_id: toolCall.id || '',
        name: toolCall.name,
      })
    }

    if (this.toolsWithIntegrationByName[functionName]) {
      const result = observation.result

      if (!result) {
        return new ToolMessage({
          content: typeof observation === 'string' ? observation : JSON.stringify(observation),
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      }

      if (result.integration) {
        await dispatchCustomEvent(AgentRoles.INTEGRATION, {
          integration: result.integration,
          user,
        })
      }

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
