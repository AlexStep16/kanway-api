import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { Types } from 'mongoose'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'
import { initOrchestratorTools } from '../../tools/initOrchestratorTools.js'
import { OrchestratorPrompt } from '../../prompts/OrchestratorPrompt.js'

export const makeOrchestratorNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotationOrc.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Думаю',
    })

    const configurable = config.configurable as Configurable

    const outputs: Partial<typeof AgentStateAnnotationOrc.State> = {
      messages: [],
      orchestrator_tool_calls: [],
      orchestrator_tool_results: [],
    }

    const { ORCHESTRATOR, ORCHESTRATOR_PRO } = deps.models

    const modelToUse =
      configurable.modelType === ModelsEnum.KANWAY_PRO ? ORCHESTRATOR_PRO : ORCHESTRATOR

    const history = state.messages.slice(-50)

    const orchestratorTools = initOrchestratorTools(deps)

    const prompt = ChatPromptTemplate.fromMessages([['system', OrchestratorPrompt], ...history])

    if (!modelToUse.bindTools) {
      throw new Error('Orchestrator model does not support tool binding.')
    }

    const chain = prompt.pipe(modelToUse.bindTools(orchestratorTools))

    const beautifiedSelections =
      state.active_selections
        ?.map(
          (selection) =>
            `- (ID: ${selection.id}) ${selection.entityType.toUpperCase()} selection with ${selection.count} items (Sample: ${JSON.stringify(selection.sample)}). Mongo Query used: ${JSON.stringify(selection.query)}`,
        )
        .join('\n') || 'No active selections'

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

    return outputs
  }
}
