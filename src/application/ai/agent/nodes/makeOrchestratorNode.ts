import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { initOrchestratorTools } from '../../tools/initOrchestratorTools.js'
import { OrchestratorPrompt } from '../../prompts/OrchestratorPrompt.js'
import { IStatus } from '@/application/interfaces/statuses/IStatus.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { getChatModel } from '@/infrastructure/helpers/getChatModel.js'
import { getBeautifiedSelections } from '../../helpers/getBeautifiedSelections.js'
import getHistoryTurns from '../../helpers/getHistoryTurns.js'

const TURNS_TO_KEEP = 4

export const makeOrchestratorNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const statusText = state.is_orchestrator_initiated
      ? 'Обрабатываю информацию'
      : 'Анализирую запрос'

    const statusUpdate: Partial<IStatus> = {
      statusText,
      currentAgent: AgentsEnum.ORCHESTRATOR,
    }
    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE, statusUpdate)

    const configurable = config.configurable as Configurable

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      messages: [],
      messages_summary: state.messages_summary,
      task_manager_messages: [],
      column_manager_messages: [],
      board_manager_messages: [],
      workspace_manager_messages: [],

      is_orchestrator_initiated: true,
      orchestrator_tool_calls: [],
      orchestrator_tool_results: [],
      current_agent: AgentsEnum.ORCHESTRATOR,
      requested_tools: [],
    }

    const modelToUse = getChatModel(configurable.modelType, true)

    const orchestratorTools = initOrchestratorTools(deps, config as RunnableConfig<Configurable>)

    const history = getHistoryTurns(state.messages, false, TURNS_TO_KEEP)

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', OrchestratorPrompt],
      new MessagesPlaceholder('history'),
    ])

    if (!modelToUse.bindTools) {
      throw new Error('Orchestrator model does not support tool binding.')
    }

    const beautifiedSelections = getBeautifiedSelections(state.active_selections || [])

    const chain = prompt.pipe(modelToUse.bindTools(orchestratorTools))

    const response = await chain.invoke({
      summary: state.messages_summary || '',
      board: configurable.activeBoard || 'NO ACTIVE BOARD',
      workspace: configurable.activeWorkspace,
      active_selections: beautifiedSelections,
      columns_list: configurable.columnsList,
      boards_list: configurable.boardsList,
      workspaces_list: configurable.workspacesList,
      current_date: configurable.currentDate,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
      history,
    })

    outputs.messages!.push(response)
    outputs.orchestrator_tool_calls = response.tool_calls || []

    if (outputs.orchestrator_tool_calls.length === 0) {
      await dispatchCustomEvent(CustomEvents.FINAL_RESPONSE, response)
    }

    return outputs
  }
}
