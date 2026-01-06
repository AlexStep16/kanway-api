import { BaseMessage } from '@langchain/core/messages'
import { Annotation, messagesStateReducer } from '@langchain/langgraph'

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  relevant_tools: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  tools_confirmed: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  tools_cancelled: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  tools_validation_errors: Annotation<{ content: string; tool_call_id: string; name: string }[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  validation_failed: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  plan: Annotation<string[]>({
    reducer: (_, y) => y,
    default: () => [],
  }),
  plan_hash: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  rag_rules: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  rag_tool_names: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  planner_has_error: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  summary: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
})
