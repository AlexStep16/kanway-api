import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { getLastIterationHistory } from '@application/ai/helpers/getLastIterationHistory.ts'
import { SynthesizePrompt } from '@/application/ai/prompts/SynthesizePrompt.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { AgentDependencies } from '@application/ai/agent/types/AgentDependencies.ts'
import { AIMessage, AIMessageChunk, BaseMessage, RemoveMessage } from '@langchain/core/messages'
import { Configurable } from '../../interfaces/Configurable.ts'
import { RunnableConfig } from '@langchain/core/runnables'
import { Types } from 'mongoose'

export const makeSynthesizeNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.SYNTHESIZE_START, null)

    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: 'Синтезирую ответ',
    })

    const configurable = config.configurable as Configurable

    const lastMessage = state.messages.at(-1)

    const messages: BaseMessage[] = []

    const { synthesizerModel } = deps.models

    let chatHistory = getLastIterationHistory(state.messages)

    if (!chatHistory) {
      // Handle case where there is no user message
      return {}
    }

    chatHistory = chatHistory.filter((m) => m.id !== lastMessage?.id)

    if (lastMessage instanceof AIMessage || lastMessage instanceof AIMessageChunk) {
      const toolCalls = lastMessage?.tool_calls || []
      const finishResponseCall = toolCalls.find((tc) => tc.name === 'finishResponse')

      if (finishResponseCall) {
        const removedMessage = new RemoveMessage({
          id: lastMessage?.id || '',
        })

        messages.push(removedMessage)
      }
    }

    const prompt = ChatPromptTemplate.fromMessages([['system', SynthesizePrompt], ...chatHistory])

    const chain = prompt.pipe(synthesizerModel)

    const response = await chain.invoke({})

    await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
      id: stepId.toString(),
      state: 'completed',
    })

    messages.push(response)

    await deps.services.userService.decrementGenerationsCount(configurable.user.id.toString(), 1)

    return {
      messages,
    }
  }
}
