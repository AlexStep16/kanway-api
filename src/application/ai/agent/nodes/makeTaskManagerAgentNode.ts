import { RunnableConfig } from '@langchain/core/runnables'
import { AgentDependencies } from '@/application/ai/agent/types/AgentDependencies.js'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { Configurable } from '@/application/ai/interfaces/Configurable.js'
import { dispatchCustomEvent } from '@langchain/core/callbacks/dispatch'
import { CustomEvents } from '@/enums/CustomEvents.js'
import { ModelsEnum } from '@/domain/enums/ModelsEnum.js'
import { AgentStateAnnotationOrc } from '../AgentStateAnnotationOrc.js'
import { TaskManagerAgentPrompt } from '../../prompts/TaskManagerAgentPrompt.js'
import { initTaskManagerTools } from '../../tools/initTaskManagerTools.js'
import { ToolMessage } from '@langchain/core/messages'
import { IStatus } from '@/application/interfaces/Statuses/IStatus.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'

export const makeTaskManagerAgentNode = (deps: AgentDependencies) => {
  return async (state: typeof AgentStateAnnotationOrc.State, config: RunnableConfig) => {
    const statusUpdate: Partial<IStatus> = {
      statusText: 'Думаю над задачей',
      currentAgent: AgentsEnum.TASK_MANAGER,
    }
    await dispatchCustomEvent(CustomEvents.STATUS_UPDATE, statusUpdate)

    const configurable = config.configurable as Configurable

    const outputs: Partial<typeof AgentStateAnnotationOrc.State> = {
      messages: [],
      task_manager_messages: state.task_manager_messages,
      task_manager_tool_calls: [],
      task_manager_tool_results: [],
      tools_reviewed_map: new Map(),
      task_manager_tool_calls_completed: [],
    }

    const lastCallManagerTool = [...state.orchestrator_tool_calls]
      .reverse()
      .find((call) => call.name === 'call_task_manager_agent')

    const history = state.task_manager_messages.slice(-50)

    const { ORCHESTRATOR, ORCHESTRATOR_PRO } = deps.models

    const modelToUse =
      configurable.modelType === ModelsEnum.KANWAY_PRO ? ORCHESTRATOR_PRO : ORCHESTRATOR

    const taskManagerTools = initTaskManagerTools(deps, config)

    const prompt = ChatPromptTemplate.fromMessages([['system', TaskManagerAgentPrompt], ...history])

    if (!modelToUse.bindTools) {
      throw new Error('Task Manager agent model does not support tool binding.')
    }

    const chain = prompt.pipe(modelToUse.bindTools(taskManagerTools))

    const response = await chain.invoke({
      board: configurable.activeBoard || 'Нет активной доски',
      workspace: configurable.activeWorkspace,
      current_date: configurable.currentDate,
      tags_list: configurable.tagsList,
      aiName: configurable.aiName,
      orchestrator_intent: JSON.stringify(lastCallManagerTool?.args || {}),
    })

    await dispatchCustomEvent(CustomEvents.TOKENS_ADDED, response.usage_metadata?.total_tokens || 0)

    outputs.task_manager_messages!.push(response)

    outputs.task_manager_tool_calls = response.tool_calls || []

    if (outputs.task_manager_tool_calls!.length === 0) {
      outputs.messages!.push(new ToolMessage(response.content, lastCallManagerTool!.id!))
    }

    return outputs
  }
}
