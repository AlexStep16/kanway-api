import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { getLastMessages } from '../../helpers/getLastMessages.ts'
import { BrainPrompt } from '../../prompts/BrainPrompt.ts'
import { initBrainTools } from '../../tools/initBrainTools.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { Types } from 'mongoose'

export const makeBrainNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Анализирую',
    })

    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const history = getLastMessages(state.messages, 20)
    const brainHistory = getLastMessages(state.brain_messages, 50)

    const brainTools = initBrainTools()

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', BrainPrompt],
      ...history,
      ...brainHistory,
    ])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(brainTools))

    const response = await chain.invoke({
      board_id: configurable.activeBoardId,
      workspace_id: configurable.activeWorkspaceId,
      current_date: configurable.currentDate,
      categories_list: configurable.categoriesList,
      tags_list: configurable.tagsList,
    })

    return {
      tool_calls: response.tool_calls || [],
    }
  }
}
