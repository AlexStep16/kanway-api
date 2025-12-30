import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { getLastChatHistory } from '@application/ai/helpers/getLastChatHistory.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ReActSystem } from '@/application/ai/systemMessages/ReAct.ts'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { getLastHumanContent } from '../../helpers/getLastHumanContent.ts'

export const makeAgentNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { toolExecutorService, baseService } = deps.services
    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const toolsByName = toolExecutorService.toolsByName
    const hotTools = toolExecutorService.hotTools

    const activeBoardId = configurable?.activeBoardId
    const activeWorkspaceId = configurable?.activeWorkspaceId
    const currentDate = configurable?.currentDate

    const chatHistory = getLastChatHistory(state.messages)

    if (!chatHistory) {
      throw new Error('Chat history is empty.')
    }

    const plan = state.plan || []

    const rawUserMsg = getLastHumanContent(state.messages)

    if (!rawUserMsg && plan.length === 0) {
      throw new Error('No user message or plan provided.')
    }

    let rules: string[] = []
    let suggestedToolsNames: string[] = []

    for (const step of plan) {
      const instructions = await baseService.similaritySearchAgentInstructions(step)

      for (const instruction of instructions) {
        if (instruction.rule && !rules.includes(instruction.rule)) {
          rules.push(instruction.rule)
        }

        suggestedToolsNames.push(...(instruction.suggestedTools || []))
      }
    }

    const finalToolsNames = new Set(hotTools.map((t) => t.name))

    // Добавляем то, что нашел RAG
    suggestedToolsNames.forEach((name) => finalToolsNames.add(name))

    // Если RAG ничего не нашел и план пуст (или агент решил вызвать getRelevantTools сам),
    // мы можем проверить, есть ли уже что-то в state.relevant_tools (от предыдущих шагов цикла)
    if (state.relevant_tools && state.relevant_tools.length > 0) {
      state.relevant_tools.forEach((t) => finalToolsNames.add(t))
    }

    const toolsToBind = Array.from(finalToolsNames)
      .map((name) => toolsByName[name])
      .filter(Boolean)

    // Формируем контекст для Агента
    let dynamicSystemPrompt = `${ReActSystem}\n\n### RELEVANT RULES:\n${rules.join('\n')}`

    if (plan.length > 0) {
      dynamicSystemPrompt += `\n\n### USER INTENT (PLAN):\nThe user wants to perform these actions:\n${plan
        .map((s) => `- ${s}`)
        .join('\n')}\nExecute them using available tools.`
    }

    dynamicSystemPrompt += `\n\n### SYSTEM CONTEXT:
    - Active Board ID: {boardId}
    - Active Workspace ID: {workspaceId}
    - Current Date: {currentDate}
    - Default category for new tasks is "{defaultCategoryName}"
    - Default board for new categories is "{defaultBoardName}"`

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', dynamicSystemPrompt],
      ...chatHistory,
    ])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(toolsToBind))

    const response = await chain.invoke({
      boardId: activeBoardId,
      workspaceId: activeWorkspaceId,
      currentDate: currentDate,
      aiName: configurable?.aiName || 'Kanbar',
      defaultCategoryName: configurable?.defaultCategoryName || '',
      defaultBoardName: configurable?.defaultBoardName || '',
    })

    return {
      messages: [response],
    }
  }
}
