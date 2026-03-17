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
  skiller_messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  coder_messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
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
  execution_output: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  resolved_ambiguities: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  final_response: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  chat_summary: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  enriched_message: Annotation<string>({
    reducer: (_, y) => y,
    default: () => '',
  }),
  enricher_has_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  related_skill_names: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  skiller_has_error: Annotation<boolean>({
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
})
