import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { PlannerSystem } from '../../systemMessages/Planner.ts'
import { getLastChatHistory } from '../../helpers/getLastChatHistory.ts'
import * as Sentry from '@sentry/node'

export const makePlannerNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    // Используем более дешевую/быструю модель для планирования (если есть), или основную
    // Planner не требует огромного контекста, glm-4p5 отлично справится
    const { agentModel } = deps.models

    const lastMessage = state.messages.at(-1)

    if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
      return { plan: [] }
    }

    // Создаем определение инструмента
    const { toolExecutorService } = deps.services
    const tools = toolExecutorService.plannerTools

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    // Создаем системный промпт для планировщика
    const chatHistory = getLastChatHistory(state.messages)

    const prompt = ChatPromptTemplate.fromMessages([['system', PlannerSystem], ...chatHistory])

    // Принудительно заставляем модель вызвать этот инструмент
    const modelWithTool = agentModel.bindTools(tools, {
      tool_choice: 'submitPlan', // <-- FORCE CALL
    })

    // Вызываем модель
    const chain = prompt.pipe(modelWithTool)

    const response = await chain.invoke({})

    // Парсим результат
    const toolCall = response.tool_calls?.[0]

    if (!toolCall || toolCall.name !== 'submitPlan') {
      Sentry.captureException(new Error('Planner did not return a valid tool call for submitPlan.'))

      const errorMessage = new ToolMessage({
        content: 'You MUST submit a plan using the submitPlan tool.',
        name: toolCall?.name,
        tool_call_id: toolCall?.id || '',
        additional_kwargs: { error: true },
      })

      return {
        plan: [],
        messages: [errorMessage],
        planner_has_error: true,
      }
    }

    const plan = toolCall.args.steps as string[]

    return {
      plan: plan,
      planner_has_error: false,
    }
  }
}
