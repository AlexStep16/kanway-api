import { RunnableConfig } from '@langchain/core/runnables'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.js'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { SummarizerPrompt } from '../../prompts/SummarizerPrompt.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { getChatModel } from '@/infrastructure/helpers/getChatModel.js'
import { shouldSummarizeHistory } from '../../helpers/shouldSummarizeHistory.js'

const TURNS_THRESHOLD = 8

export const makeSummarizerNode = () => {
  return async (state: typeof AgentStateAnnotation.State, _: RunnableConfig) => {
    if (!shouldSummarizeHistory(state.messages, TURNS_THRESHOLD)) {
      return {}
    }

    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE, {
      statusText: 'Сжимаю историю чата',
      currentAgent: AgentsEnum.SUMMARIZER,
    })

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SummarizerPrompt],
      new MessagesPlaceholder('all_messages'),
      [
        'human',
        'Carefully review the entire conversation history, tool calls, and execution results above. ' +
          'Generate an updated Factual State (entity registry and system changes) strictly following the specified output structure.',
      ],
    ])

    const model = getChatModel(ModelsEnum.GPT_5_4_NANO, false)
    const response = await prompt.pipe(model).invoke({
      existing_state: state.messages_summary || '',
      all_messages: state.messages,
    })

    return {
      messages_summary: response.text,
    }
  }
}
