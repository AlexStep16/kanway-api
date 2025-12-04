import { BaseMessageLike } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessageLike[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  relevant_tools: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  tools_confirmed: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  }),
  tools_cancelled: Annotation<string[]>({
    reducer: (x, y) => y,
    default: () => [],
  })
});