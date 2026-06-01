import { BaseMessage, ToolCall, ToolMessage } from '@langchain/core/messages'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { IToolReview } from '../interfaces/IToolReview.js'
import { ISelection } from '@/domain/entities/ISelection.js'
import { StatusLog } from '@/application/types/StatusLog.js'

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  task_manager_messages: Annotation<BaseMessage[]>({
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
  task_manager_has_error: Annotation<boolean>({
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
})
