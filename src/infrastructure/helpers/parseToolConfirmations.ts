export function parseToolConfirmations(interruptPayload: any) {
  const toolConfirmations: any[] = []

  if (interruptPayload.data && Array.isArray(interruptPayload.data)) {
    for (const confirmationData of interruptPayload.data) {
      const toolCall = confirmationData.toolCall

      let context = {}

      try {
        context = JSON.parse(confirmationData.data)
      } catch {
        context = confirmationData.data || {}
      }

      toolConfirmations.push({
        callId: toolCall.id,
        args: toolCall.args || {},
        functionName: toolCall.name,
        entityType: confirmationData.entityType,
        title: confirmationData.title,
        context,
      })
    }
  }

  return toolConfirmations
}
