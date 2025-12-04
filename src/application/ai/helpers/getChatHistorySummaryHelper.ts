import { ToolMessage } from '@langchain/core/messages'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { SummarySystem } from '../SystemMessages/Summary.ts'
import z from 'zod'
import { ChatFireworks } from '@langchain/community/chat_models/fireworks'

export async function getChatHistorySummaryHelper(messages: any[], call_id: string) {
  await dispatchCustomEvent('history_summarization_start', {})

  if (!messages || messages.length < 2) {
    await dispatchCustomEvent('history_summarization_end', {})

    return {
      messages: [
        new ToolMessage({
          content: 'No history available',
          tool_call_id: call_id,
          name: 'getChatHistory',
        }),
      ],
    }
  }

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', SummarySystem],
    ...messages.slice(0, messages.length - 1), // Exclude the last message which is the tool call
  ])

  const SummaryModel = new ChatFireworks({ model: 'accounts/fireworks/models/gpt-oss-20b' })

  const chain = prompt.pipe(
    SummaryModel.withStructuredOutput(
      z.object({
        summary: z.string(),
      })
    )
  )

  const response = await chain.invoke({})

  await dispatchCustomEvent('history_summarization_end', {})

  return new ToolMessage({
    content: response.summary,
    tool_call_id: call_id,
  })
}
