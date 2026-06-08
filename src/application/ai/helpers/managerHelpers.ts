import { AgentsEnum } from '@/enums/AgentsEnum.js'
import { initTaskManagerTools } from '../tools/initTaskManagerTools.js'
import { TaskManagerAgentPrompt } from '../prompts/TaskManagerAgentPrompt.js'
import { ColumnManagerAgentPrompt } from '../prompts/ColumnManagerAgentPrompt.js'
import { AgentStateAnnotation } from '../agent/AgentStateAnnotation.js'
import { initColumnManagerTools } from '../tools/initColumnManagerTools.js'
import { AgentDependencies } from '../agent/types/AgentDependencies.js'
import { RunnableConfig } from '@langchain/core/runnables'
import { initBoardManagerTools } from '../tools/initBoardManagerTools.js'
import { BoardManagerAgentPrompt } from '../prompts/BoardManagerAgentPrompt.js'
import { WorkspaceManagerAgentPrompt } from '../prompts/WorkspaceManagerAgentPrompt.js'
import { initWorkspaceManagerTools } from '../tools/initWorkspaceManagerTools.js'

export function getAgentManagerTools(
  agent: AgentsEnum,
  deps: AgentDependencies,
  config: RunnableConfig,
) {
  switch (agent) {
    case AgentsEnum.TASK_MANAGER:
      return initTaskManagerTools(deps, config)
    case AgentsEnum.COLUMN_MANAGER:
      return initColumnManagerTools(deps, config)
    case AgentsEnum.BOARD_MANAGER:
      return initBoardManagerTools(deps, config)
    case AgentsEnum.WORKSPACE_MANAGER:
      return initWorkspaceManagerTools(deps, config)
    default:
      return []
  }
}

export function getAgentManagerHistory(
  agent: AgentsEnum,
  state: typeof AgentStateAnnotation.State,
) {
  switch (agent) {
    case AgentsEnum.TASK_MANAGER:
      return state.task_manager_messages.slice(-50)
    case AgentsEnum.COLUMN_MANAGER:
      return state.column_manager_messages.slice(-50)
    case AgentsEnum.BOARD_MANAGER:
      return state.board_manager_messages.slice(-50)
    case AgentsEnum.WORKSPACE_MANAGER:
      return state.workspace_manager_messages.slice(-50)
    default:
      return []
  }
}

export function getAgentManagerSystemPrompt(agent: AgentsEnum) {
  switch (agent) {
    case AgentsEnum.TASK_MANAGER:
      return TaskManagerAgentPrompt
    case AgentsEnum.COLUMN_MANAGER:
      return ColumnManagerAgentPrompt
    case AgentsEnum.BOARD_MANAGER:
      return BoardManagerAgentPrompt
    case AgentsEnum.WORKSPACE_MANAGER:
      return WorkspaceManagerAgentPrompt
    default:
      return []
  }
}
