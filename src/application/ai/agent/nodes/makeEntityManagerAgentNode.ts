import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import {
  AIMessageChunk,
  MessageStructure,
  MessageToolSet,
  ToolMessage,
} from '@langchain/core/messages'
import { IStatus } from '@/application/interfaces/statuses/IStatus.js'
import { getAgentStatusText } from '@/utils/getAgentStatusText.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import {
  getAgentManagerHistory,
  getAgentManagerSystemPrompt,
  getAgentManagerTools,
} from '../../helpers/managerHelpers.js'
import { getBeautifiedSelections } from '../../helpers/getBeautifiedSelections.js'
import { initManagerTools } from '../../tools/initManagerTools.js'
import { getChatModel } from '@/infrastructure/helpers/getChatModel.js'

export const makeEntityManagerAgentNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const activeManager = state.active_manager
    const requestedTools = state.requested_tools || []

    const statusText = getAgentStatusText(activeManager)
    const statusUpdate: Partial<IStatus> = {
      statusText,
      currentAgent: activeManager,
    }

    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE, statusUpdate)

    const configurable = config.configurable as Configurable

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      messages_summary: state.messages_summary,

      task_manager_messages: state.task_manager_messages,
      task_manager_tool_calls: state.task_manager_tool_calls,
      task_manager_tool_results: state.task_manager_tool_results,
      task_manager_tool_calls_completed: state.task_manager_tool_calls_completed,

      column_manager_messages: state.column_manager_messages,
      column_manager_tool_calls: state.column_manager_tool_calls,
      column_manager_tool_results: state.column_manager_tool_results,
      column_manager_tool_calls_completed: state.column_manager_tool_calls_completed,

      board_manager_messages: state.board_manager_messages,
      board_manager_tool_calls: state.board_manager_tool_calls,
      board_manager_tool_results: state.board_manager_tool_results,
      board_manager_tool_calls_completed: state.board_manager_tool_calls_completed,

      workspace_manager_messages: state.workspace_manager_messages,
      workspace_manager_tool_calls: state.workspace_manager_tool_calls,
      workspace_manager_tool_results: state.workspace_manager_tool_results,
      workspace_manager_tool_calls_completed: state.workspace_manager_tool_calls_completed,

      tools_reviewed_map: state.tools_reviewed_map || new Map(),
      current_agent: activeManager,
      requested_tools: requestedTools,
    }

    const lastCallManagerTool = getOrchestratorManagerToolCall(state)

    const history = getAgentManagerHistory(activeManager, state)

    const modelToUse = getChatModel(configurable.modelType, true)

    const managerTools = getAgentManagerTools(activeManager, deps, config)
    const requestedManagerTools = managerTools.filter((tool) => requestedTools.includes(tool.name))

    const mainManagerTools = initManagerTools()

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', getAgentManagerSystemPrompt(activeManager)],
      ['user', 'Execute the instruction above.'],
      new MessagesPlaceholder('history'),
    ])

    if (!modelToUse.bindTools) {
      throw new Error('Manager agent model does not support tool binding.')
    }

    const chain = prompt.pipe(modelToUse.bindTools([...requestedManagerTools, ...mainManagerTools]))

    const beautifiedSelections = getBeautifiedSelections(state.active_selections || [])

    const response = await chain.invoke({
      board: configurable.activeBoard || 'Нет активной доски',
      workspace: configurable.activeWorkspace,
      current_date: configurable.currentDate,
      active_selections: beautifiedSelections,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
      orchestrator_instruction: JSON.stringify(lastCallManagerTool?.args?.instruction || {}),
      orchestrator_payload: JSON.stringify(lastCallManagerTool?.args?.payload || {}),
      available_tools_list: managerTools
        .map((tool) => tool.name)
        .filter((name) => !requestedTools.includes(name)),
      history,
    })

    fillOutputsBasedOnAgent(activeManager, response, outputs)

    if (response.tool_calls?.length === 0) {
      outputs.messages!.push(
        new ToolMessage(response.content, lastCallManagerTool!.id!, lastCallManagerTool?.name),
      )
    }

    return outputs
  }
}

function getOrchestratorManagerToolCall(state: typeof AgentStateAnnotation.State) {
  const orchestratorToolCalls = state.orchestrator_tool_calls || []
  const reversedToolCalls = [...orchestratorToolCalls].reverse()

  return reversedToolCalls.find((call) => call.name === 'call_manager_agent')
}

function fillOutputsBasedOnAgent(
  agent: AgentsEnum,
  response: AIMessageChunk<MessageStructure<MessageToolSet>>,
  outputs: Partial<typeof AgentStateAnnotation.State>,
) {
  switch (agent) {
    case AgentsEnum.TASK_MANAGER:
      outputs.task_manager_messages!.push(response)
      outputs.task_manager_tool_calls = response.tool_calls || []
      break
    case AgentsEnum.COLUMN_MANAGER:
      outputs.column_manager_messages!.push(response)
      outputs.column_manager_tool_calls = response.tool_calls || []
      break
    case AgentsEnum.BOARD_MANAGER:
      outputs.board_manager_messages!.push(response)
      outputs.board_manager_tool_calls = response.tool_calls || []
      break
    case AgentsEnum.WORKSPACE_MANAGER:
      outputs.workspace_manager_messages!.push(response)
      outputs.workspace_manager_tool_calls = response.tool_calls || []
      break
    default:
      break
  }
}
