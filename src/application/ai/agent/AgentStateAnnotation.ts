import { BaseMessage, ToolCall, ToolMessage } from '@langchain/core/messages'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { IToolReview } from '../interfaces/IToolReview.js'
import { ISelection } from '@/domain/entities/ISelection.js'
import { StatusLog } from '@/application/types/StatusLog.js'
import { AgentsEnum } from '@/enums/AgentsEnum.js'

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  user_message: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  task_manager_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  column_manager_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  board_manager_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  workspace_manager_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  /** TOOLS */
  orchestrator_tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  orchestrator_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  orchestrator_tool_calls_completed: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  task_manager_tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  task_manager_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  task_manager_tool_calls_completed: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  column_manager_tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  column_manager_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  column_manager_tool_calls_completed: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  board_manager_tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  board_manager_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  board_manager_tool_calls_completed: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  workspace_manager_tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  workspace_manager_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  workspace_manager_tool_calls_completed: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  tool_waiting_for_review: Annotation<IToolReview | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  tools_reviewed_map: Annotation<Map<string, boolean>>({
    reducer: (_, y) => y,
    default: () => new Map(),
  }),
  tools_log_map: Annotation<Map<string, StatusLog>>({
    reducer: (_, y) => y,
    default: () => new Map(),
  }),

  /** ERRORS */
  orchestrator_has_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  manager_tools_has_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),

  active_selections: Annotation<ISelection[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  is_orchestrator_initiated: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  active_manager: Annotation<AgentsEnum>({
    reducer: (_, y) => y,
    default: () => AgentsEnum.ORCHESTRATOR,
  }),
  current_agent: Annotation<AgentsEnum>({
    reducer: (_, y) => y,
    default: () => AgentsEnum.ORCHESTRATOR,
  }),
  is_manager_called: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  operation_log_ids: Annotation<Map<string, string[]>>({
    reducer: (_, y) => y,
    default: () => new Map(),
  }),
  requested_tools: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
})
