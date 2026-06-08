import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { AgentStateAnnotation } from '../AgentStateAnnotation.js'
import { initOrchestratorTools } from '../../tools/initOrchestratorTools.js'
import { OrchestratorPrompt } from '../../prompts/OrchestratorPrompt.js'
import { IStatus } from '@/application/interfaces/statuses/IStatus.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { getBeautifiedSelections } from '../../helpers/getBeautifiedSelections.js'

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
      is_orchestrator_initiated: true,
      orchestrator_tool_calls: [],
      orchestrator_tool_results: [],
      current_agent: AgentsEnum.ORCHESTRATOR,
    }

    const { ORCHESTRATOR, ORCHESTRATOR_PRO } = deps.models

    const modelToUse =
      configurable.modelType === ModelsEnum.KANWAY_PRO ? ORCHESTRATOR_PRO : ORCHESTRATOR

    const history = state.messages.slice(-50)

    const orchestratorTools = initOrchestratorTools(deps, config as RunnableConfig<Configurable>)

    const prompt = ChatPromptTemplate.fromMessages([['system', OrchestratorPrompt], ...history])

    if (!modelToUse.bindTools) {
      throw new Error('Orchestrator model does not support tool binding.')
    }

    const chain = prompt.pipe(modelToUse.bindTools(orchestratorTools))

    const beautifiedSelections = getBeautifiedSelections(state.active_selections || [])

    const response = await chain.invoke({
      board: configurable.activeBoard || 'NO ACTIVE BOARD',
      workspace: configurable.activeWorkspace,
      current_date: configurable.currentDate,
      tags_list: configurable.tagsList,
      active_selections: beautifiedSelections,
      aiName: configurable.aiName,
    })

    await dispatchCustomEvent(CustomEvents.TOKENS_ADDED, response.usage_metadata?.total_tokens || 0)

    outputs.messages!.push(response)
    outputs.orchestrator_tool_calls = response.tool_calls || []

    if (outputs.orchestrator_tool_calls.length === 0) {
      await dispatchCustomEvent(CustomEvents.FINAL_RESPONSE, response)
    }

    return outputs
  }
}
