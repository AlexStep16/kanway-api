import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ReplannerPrompt } from '../../prompts/ReplannerPrompt.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { Types } from 'mongoose'
import { initReplannerTools } from '../../tools/initReplannerTools.ts'
import getLastHumanMessage from '../../helpers/getLastHumanMessage.ts'

export const makeReplannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Проверяю результаты',
    })

    const lastHumanMessage = getLastHumanMessage(state.messages)

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      replanner_has_error: false,
      replanner_messages: [],
    }

    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const replannerTools = initReplannerTools()

    const currentPlanText = state.current_plan.length
      ? state.current_plan.map((step, index) => `${index + 1}. ${step}`).join('\n')
      : 'No current plan.'

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', ReplannerPrompt],
      lastHumanMessage!,
      ...state.last_execution_messages,
      ...state.replanner_messages,
    ])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(replannerTools))

    const response = await chain.invoke({
      board_id: configurable.activeBoardId,
      workspace_id: configurable.activeWorkspaceId,
      current_date: configurable.currentDate,
      categories_list: configurable.categoriesList,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
      current_plan: currentPlanText,
    })

    outputs.tool_calls = response.tool_calls || []

    return outputs
  }
}
