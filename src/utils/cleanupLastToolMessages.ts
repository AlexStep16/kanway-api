import { RunnableConfig } from '@langchain/core/runnables'
import { CompiledStateGraph, StateSnapshot } from '@langchain/langgraph'
import {
  AIMessage,
  Message,
  RemoveMessage,
  ToolMessage,
  ToolMessageChunk,
} from '@langchain/core/messages'

export async function cleanupLastToolMessages(
  agent: CompiledStateGraph<any, any>,
  config: RunnableConfig,
  currentState: StateSnapshot,
) {
  const messages = currentState.values.messages || []

  if (messages.length === 0) return

  const messagesToDelete = messages.filter((msg: Message) => {
    if (ToolMessage.isInstance(msg) || ToolMessageChunk.isInstance(msg)) return true
    if (AIMessage.isInstance(msg) && (msg.tool_calls?.length || 0) > 0) return true

    return false
  })

  if (messagesToDelete.length > 0) {
    const removeRequests = messagesToDelete.map((msg: any) => new RemoveMessage({ id: msg.id }))

    return await agent.updateState(config, {
      messages: removeRequests,
    })
  }
}
