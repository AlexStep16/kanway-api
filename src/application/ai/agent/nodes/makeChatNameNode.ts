import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { Types } from 'mongoose'
import { Configurable } from '../../interfaces/Configurable.ts'
import getLastAiMessage from '../../helpers/getLastAiMessage.ts'
import { ChatNamePrompt } from '../../prompts/ChatNamePrompt.ts'

export const makeChatNameNode = (deps: AgentDependencies): any => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const configurable = config.configurable as Configurable

    if (!configurable.isChatNameNeeded) return {}

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: new Types.ObjectId().toString(),
      name: 'Придумываю название чату',
    })
    await dispatchCustomEvent(CustomEvents.SYNTHESIZE_END, {})

    const { chatNameModel } = deps.models

    const lastAIMessage = getLastAiMessage(state.messages)

    const prompt = ChatPromptTemplate.fromMessages([['system', ChatNamePrompt]])

    const chain = prompt.pipe(chatNameModel)

    const response = await chain.invoke({
      user_message: configurable.userMessage,
      assistant_response: lastAIMessage?.text,
    })

    await dispatchCustomEvent(CustomEvents.CHAT_UPDATED, {
      name: response.text,
    })

    return {}
  }
}
