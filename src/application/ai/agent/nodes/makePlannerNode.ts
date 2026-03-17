import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { BaseMessage, RemoveMessage, SystemMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { PlannerPrompt } from '@application/ai/prompts/PlannerPrompt.ts'
import { getLastChatHistory } from '../../helpers/getLastChatHistory.ts'
//import * as Sentry from '@sentry/node'
import getLastHumanMessage from '../../helpers/getLastHumanMessage.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Types } from 'mongoose'
import { SKILLS_GROUP } from '@/constants/SKILLS_GROUP.ts'
import { Configurable } from '../../interfaces/Configurable.ts'

export const makePlannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const activeBoardName = configurable?.activeBoardName
    const activeWorkspaceName = configurable?.activeWorkspaceName
    const currentDate = configurable?.currentDate

    const lastHumanMessage = getLastHumanMessage(state.messages)

    if (!lastHumanMessage) {
      return { plan: [], planner_has_error: false }
    }

    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: 'Составляю план',
    })

    const { toolExecutorService } = deps.services
    const tools = toolExecutorService.plannerTools

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const lastChatHistory = getLastChatHistory(state.messages)
    const summaryHistory = state.summary

    if (!lastChatHistory) {
      throw new Error('Chat history is empty.')
    }
    // Формируем контекст для Агента
    let dynamicSystemPrompt = PlannerPrompt

    if (summaryHistory) {
      dynamicSystemPrompt += `\n\n### CHAT SUMMARY:
      ${summaryHistory}`
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', dynamicSystemPrompt],
      ...lastChatHistory,
    ])

    const modelWithTool = agentModel.bindTools(tools)

    const chain = prompt.pipe(modelWithTool)

    const response = await chain.invoke({
      aiName: configurable?.aiName || 'Kanbar',
      boardName: activeBoardName,
      workspaceName: activeWorkspaceName,
      currentDate: currentDate,

      SEARCH_SKILLS: SKILLS_GROUP.SEARCH.map((s) => s.name).join(', '),
      TASK_BASE_SKILLS: SKILLS_GROUP.TASK_BASE.map((s) => s.name).join(', '),
      TASK_UPDATE_SKILLS: SKILLS_GROUP.TASK_UPDATE.map((s) => s.name).join(', '),
      BOARD_BASE_SKILLS: SKILLS_GROUP.BOARD_BASE.map((s) => s.name).join(', '),
      BOARD_UPDATE_SKILLS: SKILLS_GROUP.BOARD_UPDATE.map((s) => s.name).join(', '),
      CATEGORY_BASE_SKILLS: SKILLS_GROUP.CATEGORY_BASE.map((s) => s.name).join(', '),
      CATEGORY_UPDATE_SKILLS: SKILLS_GROUP.CATEGORY_UPDATE.map((s) => s.name).join(', '),
      WORKSPACE_BASE_SKILLS: SKILLS_GROUP.WORKSPACE_BASE.map((s) => s.name).join(', '),
      WORKSPACE_UPDATE_SKILLS: SKILLS_GROUP.WORKSPACE_UPDATE.map((s) => s.name).join(', '),
    })

    const messages: BaseMessage[] = state.messages
      .filter((msg) => msg.additional_kwargs?.error && msg.additional_kwargs?.isPlanner)
      .map(
        (m) =>
          new RemoveMessage({
            id: m.id!,
          }),
      )

    messages.push(response)

    const toolCall = response.tool_calls?.[0]
    const invalidToolCalls = response.invalid_tool_calls?.[0]

    await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
      id: stepId.toString(),
      state: 'completed',
    })

    if (
      !toolCall ||
      !['executePlan', 'finishResponse'].includes(toolCall.name) ||
      invalidToolCalls
    ) {
      //Sentry.captureException(new Error('Planner did not return a valid tool call.'))

      let content = 'You MUST respond only with a valid tool call (executePlan or finishResponse).'

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

    if (toolCall.name === 'finishResponse') {
      return {
        plan: [],
        messages,
        planner_has_error: false,
      }
    }

    const plan = toolCall.args.steps as string[]
    const skills = toolCall.args.relevantInstructions as string[]
    const reasoning = toolCall.args.reasoning as string

    // Если план есть, но нет инструкций, это тоже ошибка, потому что план должен быть выполнимым
    if (plan.length > 0 && skills.length === 0) {
      //Sentry.captureException(new Error('Planner returned a plan but no relevant instructions.'))
      const errorMessage = new SystemMessage({
        content: 'Planner returned a plan but no relevant instructions.',
        additional_kwargs: { error: true, isPlanner: true },
      })

      return {
        plan: [],
        messages: [errorMessage],
        planner_has_error: true,
      }
    }

    messages.push(new RemoveMessage({ id: response.id! }))

    return {
      plan,
      skills,
      messages,
      planner_reasoning: reasoning,
      planner_has_error: false,
    }
  }
}
