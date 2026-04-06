import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ReplannerPrompt } from '../../prompts/ReplannerPrompt.ts'
import { Configurable } from '@/application/ai/interfaces/Configurable.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { Types } from 'mongoose'
import { initReplannerTools } from '../../tools/initReplannerTools.ts'
import { ReplannerAnalyse } from '../../prompts/ReplannerAnalyse.ts'

export const makeReplannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Проверяю результаты',
    })
    await dispatchCustomEvent(CustomEvents.SYNTHESIZE_START, {})

    const outputs: Partial<typeof AgentStateAnnotation.State> = {
      tool_calls: [],
      replanner_has_error: false,
      replanner_messages: [],
      messages: [],
    }

    const { replannerModel } = deps.models

    const configurable = config.configurable as Configurable

    const replannerTools = initReplannerTools()

    let completedSteps = ''
    let remainingSteps = ''

    for (let i = 0; i < state.current_plan.length; i++) {
      const step = `${i + 1}. ${state.current_plan[i]}\n`

      if (state.current_step_index === i) {
        completedSteps = step
      } else if (state.current_step_index > i) {
        remainingSteps += step
      }
    }

    if (!remainingSteps) remainingSteps = 'Empty'

    const lastExecutionResult = state.last_execution_messages
      .map((message) => `- ${message.text}`)
      .join('\n')

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', ReplannerPrompt],
      ['user', ReplannerAnalyse],
      ...state.replanner_messages,
    ])

    if (!replannerModel.bindTools) {
      throw new Error('Replanner model does not support tool binding.')
    }

    const chain = prompt.pipe(replannerModel.bindTools(replannerTools))

    const response = await chain.invoke({
      board_id: configurable.activeBoardId,
      workspace_id: configurable.activeWorkspaceId,
      current_date: configurable.currentDate,
      categories_list: configurable.categoriesList,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
      completed_steps: completedSteps,
      remaining_steps: remainingSteps,
      user_message: configurable.userMessage,
      last_execution_result: lastExecutionResult,
    })

    outputs.tool_calls = response.tool_calls || []

    if (outputs.tool_calls.length === 0) {
      await dispatchCustomEvent(CustomEvents.FINAL_RESPONSE, response)

      outputs.messages!.push(response)
    }

    return outputs
  }
}
