import { BaseMessage, ToolCall, ToolMessage } from '@langchain/core/messages'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ZodSchema } from 'zod/v3'
import { getChatHistorySummaryHelper } from '@application/ai/helpers/getChatHistorySummaryHelper.ts'
import { getChatHistoryWrapper } from '@application/ai/helpers/getChatHistoryWrapper.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { BaseService } from '@application/services/BaseService.ts'
import IToolResult from '@application/interfaces/IToolResult.ts'
import { AgentRoles } from '@/enums/AgentRoles.ts'
import { createTools } from '../helpers/toolsHelper.ts'
import { TaskToolAdapter } from '../tools/TaskToolAdapter.ts'
import { CategoryToolAdapter } from '../tools/CategoryToolAdapter.ts'
import { BoardToolAdapter } from '../tools/BoardToolAdapter.ts'
import { WorkspaceToolAdapter } from '../tools/WorkspaceToolAdapter.ts'
import { OperationLogService } from '@/application/services/OperationLogService.ts'
import { IUser } from '@/domain/entities/IUser.ts'

export class ToolExecutorService {
  protected baseService: BaseService
  protected taskToolAdapter: TaskToolAdapter
  protected categoryToolAdapter: CategoryToolAdapter
  protected boardToolAdapter: BoardToolAdapter
  protected workspaceToolAdapter: WorkspaceToolAdapter
  protected operationLogService: OperationLogService
  public tools: DynamicStructuredTool[]
  public toolsByName: Record<string, DynamicStructuredTool>
  public toolsWithIntegrationByName: Record<string, DynamicStructuredTool>
  public hotTools: DynamicStructuredTool[]

  constructor(
    baseService: BaseService,
    operationLogService: OperationLogService,
    taskToolAdapter: TaskToolAdapter,
    categoryToolAdapter: CategoryToolAdapter,
    boardToolAdapter: BoardToolAdapter,
    workspaceToolAdapter: WorkspaceToolAdapter
  ) {
    this.baseService = baseService
    this.taskToolAdapter = taskToolAdapter
    this.categoryToolAdapter = categoryToolAdapter
    this.boardToolAdapter = boardToolAdapter
    this.workspaceToolAdapter = workspaceToolAdapter
    this.operationLogService = operationLogService

    const tools = createTools(
      this.taskToolAdapter,
      this.boardToolAdapter,
      this.categoryToolAdapter,
      this.workspaceToolAdapter,
      this.operationLogService
    )

    this.tools = tools.entityTools
    this.toolsByName = tools.toolsByName
    this.toolsWithIntegrationByName = tools.toolsWithIntegrationByName
    this.hotTools = tools.hotTools
  }

  private async _getRelevantTools(steps: Array<{ description: string }>) {
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

  public async executeTool(
    toolCall: ToolCall,
    relevantToolNames: string[],
    messages: BaseMessage[],
    user: IUser
  ) {
    const functionName = toolCall.name
    const tool: DynamicStructuredTool = this.toolsByName[functionName]

    if (!tool) {
      return new ToolMessage({
        content: `Инструмент с именем "${functionName}" не найден.`,
        name: toolCall.name,
        tool_call_id: toolCall.id || '',
      })
    }

    const functionSchema = tool.schema as ZodSchema

    if (functionSchema) {
      const validationResult = functionSchema.safeParse(toolCall.args)

      if (!validationResult.success) {
        return new ToolMessage({
          content: `Ошибка валидации аргументов: ${validationResult.error.issues
            .map((issue: any) => `${issue.path.join('.')} - ${issue.message}`)
            .join('; ')}`,
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      }
    }

    if (tool.name === 'getChatHistory') {
      if (toolCall.args.return_summary === true)
        return getChatHistorySummaryHelper(messages, toolCall.id)

      return getChatHistoryWrapper(messages)
    }

    if (tool.name === 'getRelevantTools') {
      const { relevantNames } = await this._getRelevantTools(toolCall.args.steps)

      relevantToolNames.push(...(relevantNames || []))

      return new ToolMessage({
        content: `Я нашел инструменты.`,
        tool_call_id: toolCall.id || '',
      })
    }

    const observation: IToolResult = await tool.invoke(toolCall.args)

    if (this.toolsWithIntegrationByName[functionName]) {
      const result = observation.result

      if (!result) {
        return new ToolMessage({
          content: typeof observation === 'string' ? observation : JSON.stringify(observation),
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      }

      if (result?.integration) {
        await dispatchCustomEvent(AgentRoles.INTEGRATION, {
          integration: result?.integration,
          user,
        })
      }

      if (result.data !== undefined) {
        return new ToolMessage({
          content: typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
        })
      } else {
        return new ToolMessage({
          content: typeof observation === 'string' ? observation : JSON.stringify(observation),
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
