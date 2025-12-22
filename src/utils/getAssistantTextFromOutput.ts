export function getAssistantTextFromOutput(output: any): string | null {
  if (!output) return null
  if (typeof output.content === 'string' && output.content.trim()) return output.content

  const msgs = Array.isArray(output.messages) ? output.messages : []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    const ctor = m?.constructor?.name
    const type = m?.type || m?._getType?.()
    const isAI = ctor === 'AIMessage' || ctor === 'AIMessageChunk' || type === 'ai'
    if (!isAI) continue
    const c = m.content
    if (typeof c === 'string' && c.trim()) return c
    if (Array.isArray(c)) {
      const txt = c
        .map((seg) => (typeof seg?.text === 'string' ? seg.text : ''))
        .join('')
        .trim()
      if (txt) return txt
    }
  }
  return null
}
