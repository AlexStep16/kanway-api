import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.ts'
import { AgentStateAnnotation } from '@/application/ai/agent/AgentStateAnnotation.ts'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ExecutorPrompt } from '@/application/ai/prompts/ExecutorPrompt.ts'
import { Configurable } from '@application/ai/interfaces/Configurable.ts'
import { getLastHumanContent } from '../../helpers/getLastHumanContent.ts'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.ts'
import { Types } from 'mongoose'

export const makeExecutorNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotation.State, config: RunnableConfig) => {
    const { toolExecutorService, agentSkillService } = deps.services
    const { agentModel } = deps.models

    const configurable = config.configurable as Configurable

    const activeBoardName = configurable?.activeBoardName
    const activeWorkspaceName = configurable?.activeWorkspaceName
    const currentDate = configurable?.currentDate

    const toolsByName = toolExecutorService.toolsByName
    const executorTools = toolExecutorService.executorTools

    const stepId = new Types.ObjectId()

    await dispatchCustomEvent(CustomEvents.STEP_ADD, {
      id: stepId.toString(),
      name: 'Размышляю',
    })

    const plan = state.plan || []
    const skillNames = state.skills || []
    const suggestedToolsNames: string[] = []

    const rawUserMsg = getLastHumanContent(state.messages)

    if (!rawUserMsg && plan.length === 0) {
      throw new Error('No user message or plan provided.')
    }

    const skills = await agentSkillService.getByCriteria({ names: skillNames })

    for (const skill of skills) {
      if (skill) {
        suggestedToolsNames.push(...skill.suggestedTools)
      }
    }

    const executorToolsNames = new Set(executorTools.map((t) => t.name))

    suggestedToolsNames.forEach((name) => executorToolsNames.add(name))

    // Если RAG ничего не нашел и план пуст (или агент решил вызвать getRelevantTools сам),
    // мы можем проверить, есть ли уже что-то в state.relevant_tools (от предыдущих шагов цикла)
    if (state.relevant_tools && state.relevant_tools.length > 0) {
      state.relevant_tools.forEach((t) => executorToolsNames.add(t))
    }

    const toolsToBind = Array.from(executorToolsNames)
      .map((name) => toolsByName[name])
      .filter(Boolean)

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', ExecutorPrompt],
      ...state.executor_messages,
    ])

    if (!agentModel.bindTools) {
      throw new Error('Agent model does not support tool binding.')
    }

    const chain = prompt.pipe(agentModel.bindTools(toolsToBind))

    const response = await chain.invoke({
      aiName: configurable?.aiName || 'Kanbar',
      boardName: activeBoardName,
      workspaceName: activeWorkspaceName,
      currentDate: currentDate,

      plan: plan.join('\n'),
      skills: skills.map((s) => s.rule).join('\n'),
      plan_reasoning: state.planner_reasoning || '',
    })

    const updates: any = {
      messages: [response],
      executor_messages: [response],
    }

    await dispatchCustomEvent(CustomEvents.STEP_UPDATE, {
      id: stepId.toString(),
      state: 'completed',
    })

    return updates
  }
}
