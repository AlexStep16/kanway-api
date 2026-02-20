import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { HumanMessage } from '@langchain/core/messages'
import { RunnableConfig } from '@langchain/core/runnables'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ChatbotPrompt } from '@application/ai/prompts/ChatbotPrompt.ts'
import { getLastChatHistory } from '@application/ai/helpers/getLastChatHistory.ts'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { Configurable } from '../../interfaces/Configurable.ts'
import { Types } from 'mongoose'

export const makeChatbotNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    await dispatchCustomEvent(CustomEvents.SYNTHESIZE_START, null)

    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: 'Синтезирую ответ',
    })

    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const activeBoardId = configurable?.activeBoardId
    const activeWorkspaceId = configurable?.activeWorkspaceId
    const currentDate = configurable?.currentDate

    const lastMessage = state.messages.at(-1)

    if (!lastMessage || !(lastMessage instanceof HumanMessage))
      throw new Error('Last message is not a human message.')

    // Создаем системный промпт для чатбота
    const chatHistory = getLastChatHistory(state.messages)

    let dynamicSystemPrompt =
      ChatbotPrompt +
      `\n\n### SYSTEM CONTEXT:
    - Active Board ID: {boardId}
    - Active Workspace ID: {workspaceId}
    - Current Date: {currentDate}
    - Default category for new tasks is "{defaultCategoryName}"
    - Default board for new categories is "{defaultBoardName}"`

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', dynamicSystemPrompt],
      ...chatHistory,
    ])

    // Вызываем модель
    const chain = prompt.pipe(agentModel)

    const response = await chain.invoke({
      boardId: activeBoardId,
      workspaceId: activeWorkspaceId,
      currentDate: currentDate,
      aiName: configurable?.aiName || 'Kanbar',
      defaultCategoryName: configurable?.defaultCategoryName || '',
      defaultBoardName: configurable?.defaultBoardName || '',
    })

    await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
      id: stepId.toString(),
      state: 'completed',
    })

    return {
      messages: [response],
    }
  }
}
