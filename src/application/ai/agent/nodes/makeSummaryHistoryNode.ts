import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { getLastChatHistory } from '@application/ai/helpers/getLastChatHistory.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { SummaryPrompt } from '@/application/ai/prompts/SummaryPrompt.ts'
import z from 'zod'

export const makeSummaryHistoryNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.HISTORY_RETRIEVING, null)

    const messages = state.messages
    const { summarizerModel } = deps.models

    const lastChatHistory = getLastChatHistory(state.messages, 10)

    if (!lastChatHistory || lastChatHistory.length <= 10) {
      return {}
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SummaryPrompt],
      ...messages.filter((m) => !lastChatHistory.includes(m)),
    ])

    const chain = prompt.pipe(
      summarizerModel.withStructuredOutput(
        z.object({
          summary: z.string(),
        }),
      ),
    )

    const response = await chain.invoke({})

    return {
      summary: response.summary,
    }
  }
}
