import { BaseMessage, ToolCall } from '@langchain/core/messages'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'
import { ToolResult } from '../tools/helpers/ToolResult.ts'

export interface PendingToolCall {
  id: string
  name: string
  args: Record<string, any>
}

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  final_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  planner_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  current_plan: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  current_payload: Annotation<Record<string, any>>({
    reducer: (_, y) => y,
    default: () => ({}),
  }),
  last_planner_tool_name: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),

  coder_messages: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  coder_errors: Annotation<BaseMessage[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  coder_has_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  coder_has_confirmations: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  coder_ambiguities: Annotation<{
    call_id: string
    entity_type: string
    ids: string[]
    min_select: number
    max_select: number
    id: string
  } | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  coder_has_ambiguities: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  coder_code: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  coder_iterations: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  resolved_ambiguities: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  planner_has_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),

  tool_calls: Annotation<ToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  pending_internal_tool_calls: Annotation<PendingToolCall[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  internal_tool_call_results: Annotation<Record<string, ToolResult>[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  internal_tool_calls_have_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),

  coder_steps_count: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  planner_steps_count: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
})
