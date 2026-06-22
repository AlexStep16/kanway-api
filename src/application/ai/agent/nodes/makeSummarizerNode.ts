import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { SummarizerPrompt } from '../../prompts/SummarizerPrompt.js'
import { HumanMessage, RemoveMessage, ToolMessage } from '@langchain/core/messages'
import { getTextHistory } from '../../helpers/getTextHistory.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { getChatModel } from '@/infrastructure/helpers/getChatModel.js'

export const makeSummarizerNode = (): any => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    if (state.messages.length < 25) return {}

    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE, {
      statusText: 'Сжимаю историю чата',
      currentAgent: AgentsEnum.SUMMARIZER,
    })

    let summaryBoundary = 20

    while (
      summaryBoundary < state.messages.length &&
      state.messages[summaryBoundary] instanceof ToolMessage
    ) {
      summaryBoundary++
    }

    const messagesToSummarize = state.messages.slice(0, summaryBoundary)
    const remainingMessages = state.messages
      .slice(summaryBoundary)
      .map((msg) => ({ ...msg, id: undefined }))
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

    const model = getChatModel(ModelsEnum.GPT_5_4_NANO, false)

    const chain = prompt.pipe(model)

    const response = await chain.invoke({ chat_history: chatHistory })

    return {
      messages: [
        ...removeMessages,
        new HumanMessage('[SUMMARY]:\n' + response.text),
        ...remainingMessages,
      ],
    }
  }
}
