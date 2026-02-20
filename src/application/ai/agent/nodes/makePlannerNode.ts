import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { RemoveMessage, SystemMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { PlannerPrompt } from '@application/ai/prompts/PlannerPrompt.ts'
import { getLastChatHistory } from '../../helpers/getLastChatHistory.ts'
import * as Sentry from '@sentry/node'
import getLastHumanMessage from '../../helpers/getLastHumanMessage.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Types } from 'mongoose'

export const makePlannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    const { agentModel } = deps.models

    const lastHumanMessage = getLastHumanMessage(state.messages)

    if (!lastHumanMessage) {
      return { plan: [], planner_has_error: false }
    }

    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: 'Планирую',
    })

    const { toolExecutorService } = deps.services
    const tools = toolExecutorService.plannerTools

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chatHistory = getLastChatHistory(state.messages)

    const prompt = ChatPromptTemplate.fromMessages([['system', PlannerPrompt], ...chatHistory])

    const modelWithTool = agentModel.bindTools(tools, {
      tool_choice: 'submitPlan',
    })

    const chain = prompt.pipe(modelWithTool)

    const response = await chain.invoke({})

    const messages = state.messages
      .filter((msg) => msg.additional_kwargs?.error && msg.additional_kwargs?.isPlanner)
      .map(
        (m) =>
          new RemoveMessage({
            id: m.id!,
          }),
      )

    const toolCall = response.tool_calls?.[0]
    const invalidToolCalls = response.invalid_tool_calls?.[0]

    if (!toolCall || toolCall.name !== 'submitPlan' || invalidToolCalls) {
      //Sentry.captureException(new Error('Planner did not return a valid tool call for submitPlan.'))

      let content = 'You MUST submit a plan using the submitPlan tool.'

      if (invalidToolCalls) {
        content += ` Error: ${invalidToolCalls.error}`
      }

      const errorMessage = new SystemMessage({
        content,
        additional_kwargs: { error: true, isPlanner: true },
      })

      return {
        plan: [],
        messages: [errorMessage],
        planner_has_error: true,
      }
    }

    const plan = toolCall.args.steps as string[]

    await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
      id: stepId.toString(),
      state: 'completed',
    })

    return {
      plan: plan,
      messages,
      planner_has_error: false,
    }
  }
}
