import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { PlannerPrompt } from '../../prompts/PlannerPrompt.js'
import { initPlannerTools } from '../../tools/initPlannerTools.js'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { Types } from 'mongoose'
import { STEP_MESSAGES } from '@/constants/STEP_MESSAGES.js'

export const makePlannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const stepIndex = state.planner_steps_count % STEP_MESSAGES.Planner.length
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: STEP_MESSAGES.Planner[stepIndex],
    })

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      final_messages: state.final_messages,
      planner_has_error: false,
      planner_steps_count: state.planner_steps_count + 1,
    }

    const { plannerModel } = deps.models

    const configurable = config.configurable as Configurable

    const history = state.messages.slice(-50)

    const plannerTools = initPlannerTools()

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', PlannerPrompt],
      ...history,
      ...state.planner_messages,
    ])

    if (!plannerModel.bindTools) {
      throw new Error('Planner model does not support tool binding.')
    }

    const chain = prompt.pipe(plannerModel.bindTools(plannerTools))

    const response = await chain.invoke({
      board: configurable.activeBoard || 'Нет активной доски',
      workspace: configurable.activeWorkspace,
      current_date: configurable.currentDate,
      categories_list: configurable.categoriesList,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
    })

    await dispatchCustomEvent(CustomEvents.TOKENS_ADDED, response.usage_metadata?.total_tokens || 0)

    outputs.tool_calls = response.tool_calls || []

    if (outputs.tool_calls.length === 0) {
      await dispatchCustomEvent(CustomEvents.FINAL_RESPONSE, response)

      outputs.final_messages!.push(response)
    }

    return outputs
  }
}
