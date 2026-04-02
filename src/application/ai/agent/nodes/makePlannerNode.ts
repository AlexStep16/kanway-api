import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { getLastMessages } from '../../helpers/getLastMessages.ts'
import { PlannerPrompt } from '../../prompts/PlannerPrompt.ts'
import { initPlannerTools } from '../../tools/initPlannerTools.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEventsNew.ts'
import { Types } from 'mongoose'

export const makePlannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Планирую',
    })

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      planner_has_error: false,
    }

    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const history = getLastMessages(state.messages, 20)

    const plannerTools = initPlannerTools()

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', PlannerPrompt],
      ...history,
      ...state.planner_messages,
    ])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(plannerTools))

    const response = await chain.invoke({
      board_id: configurable.activeBoardId,
      workspace_id: configurable.activeWorkspaceId,
      current_date: configurable.currentDate,
      categories_list: configurable.categoriesList,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
    })

    outputs.tool_calls = response.tool_calls || []

    return outputs
  }
}
