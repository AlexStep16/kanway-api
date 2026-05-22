import { BaseMessage, ToolCall, ToolMessage } from '@langchain/core/messages'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { ISelection } from '../interfaces/ISelection.js'

export interface PendingToolCall {
  id: string
  name: string
  args: Record<string, any>
}

export const AgentStateAnnotationOrc = Annotation.Root({
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
  task_manager_tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  orchestrator_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  task_manager_tool_results: Annotation<ToolMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
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
})
