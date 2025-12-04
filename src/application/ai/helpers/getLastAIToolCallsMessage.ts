export default function getLastAIToolCallsMessage(messages: any[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.tool_calls && message.tool_calls.length > 0) {
      return message
    }
  }

  return null
}
