import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { SummarizerPrompt } from '../../prompts/SummarizerPrompt.js'
import { HumanMessage, RemoveMessage } from '@langchain/core/messages'
import { getTextHistory } from '../../helpers/getTextHistory.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'

export const makeSummarizerNode = (deps: AgentDependencies): any => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    if (state.messages.length < 25) return {}

    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE, {
      statusText: 'Сжимаю историю чата',
      currentAgent: AgentsEnum.SUMMARIZER,
    })

    const { SUMMARIZER } = deps.models

    const messagesToSummarize = state.messages.slice(0, 20)
    const remainingMessages = state.messages.map((msg) => ({ ...msg, id: undefined })).slice(20)
    const removeMessages = state.messages
      .map((msg) =>
        msg.id
          ? new RemoveMessage({
              id: msg.id,
            })
          : null,
      )
      .filter(Boolean)

    const prompt = ChatPromptTemplate.fromMessages([['system', SummarizerPrompt]])

    const chatHistory = getTextHistory(messagesToSummarize)

    const chain = prompt.pipe(SUMMARIZER)

    const response = await chain.invoke({ chat_history: chatHistory })

    await dispatchCustomEvent(CustomEvents.TOKENS_ADDED, response.usage_metadata?.total_tokens || 0)

    return {
      messages: [
        ...removeMessages,
        new HumanMessage('[SUMMARY]:\n' + response.text),
        ...remainingMessages,
      ],
    }
  }
}
