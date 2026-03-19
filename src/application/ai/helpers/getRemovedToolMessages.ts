import { AIMessage, AIMessageChunk, BaseMessage, RemoveMessage } from '@langchain/core/messages'

export default function getRemovedToolMessages(messages: BaseMessage[]) {
  const messagesToRemove: RemoveMessage[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if ((m instanceof AIMessage || m instanceof AIMessageChunk) && m.tool_calls?.length) {
      messagesToRemove.push(
        new RemoveMessage({
          id: m.id!,
        }),
      )
    }
  }

  return messagesToRemove
}
