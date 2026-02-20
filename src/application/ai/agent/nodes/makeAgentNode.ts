import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { getLastChatHistory } from '@application/ai/helpers/getLastChatHistory.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { AgentPrompt } from '@/application/ai/prompts/AgentPrompt.ts'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { getLastHumanContent } from '../../helpers/getLastHumanContent.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { Types } from 'mongoose'

export const makeAgentNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { toolExecutorService, vectorSearchService } = deps.services
    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const toolsByName = toolExecutorService.toolsByName
    const hotTools = toolExecutorService.hotTools

    const activeBoardId = configurable?.activeBoardId
    const activeWorkspaceId = configurable?.activeWorkspaceId
    const currentDate = configurable?.currentDate

    const lastChatHistory = getLastChatHistory(state.messages)
    const summaryHistory = state.summary

    if (!lastChatHistory) {
      throw new Error('Chat history is empty.')
    }

    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: 'Размышляю',
    })

    const plan = state.plan || []
    const currentPlanHash = plan.join('||')

    const rawUserMsg = getLastHumanContent(state.messages)

    if (!rawUserMsg && plan.length === 0) {
      throw new Error('No user message or plan provided.')
    }

    let rules = state.rag_rules || []
    let suggestedToolsNames = state.rag_tool_names || []
    let hasNewCache = false

    if (plan.length > 0 && state.plan_hash !== currentPlanHash) {
      const newRules = new Set<string>()
      const newTools = new Set<string>()

      for (const step of plan) {
        const instructions = await vectorSearchService.similaritySearchAgentInstructions(step)
        for (const instruction of instructions) {
          if (instruction.rule) newRules.add(instruction.rule)
          if (instruction.suggestedTools) {
            instruction.suggestedTools.forEach((t) => newTools.add(t))
          }
        }
      }

      rules = Array.from(newRules)
      suggestedToolsNames = Array.from(newTools)
      hasNewCache = true // Пометим, что надо обновить стейт

      hasNewCache = true
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
    let dynamicSystemPrompt = `${AgentPrompt}\n\n### RELEVANT RULES:\n${rules.join('\n')}`

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

    if (summaryHistory) {
      dynamicSystemPrompt += `\n\n### CHAT SUMMARY:
      ${summaryHistory}`
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', dynamicSystemPrompt],
      ...lastChatHistory,
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

    const updates: any = {
      messages: [response],
    }

    if (hasNewCache) {
      updates.rag_rules = rules
      updates.rag_tool_names = suggestedToolsNames
      updates.plan_hash = currentPlanHash
    }

    await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
      id: stepId.toString(),
      state: 'completed',
    })

    return updates
  }
}
