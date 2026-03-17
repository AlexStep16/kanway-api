import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/aiNew/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/aiNew/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { getLastMessages } from '../../helpers/getLastMessages.ts'
import { EnricherPrompt } from '../../prompts/EnricherPrompt.ts'
import { initHotTools } from '../../tools/initHotTools.ts'
import { initEnricherTools } from '../../tools/initEnricherTools.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { Types } from 'mongoose'

export const makeEnricherNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Анализирую',
    })

    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const history = getLastMessages(state.messages)

    const hotTools = initHotTools()
    const enricherTools = initEnricherTools()
    const allTools = [...hotTools, ...enricherTools]

    const prompt = ChatPromptTemplate.fromMessages([['system', EnricherPrompt], ...history])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(allTools))

    const response = await chain.invoke({
      board_id: configurable.activeBoardId,
      workspace_id: configurable.activeWorkspaceId,
      current_date: configurable.currentDate,
    })

    return {
      messages: [response],
      tool_calls: response.tool_calls || [],
    }
  }
}
