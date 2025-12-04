export function getLCMessageKind(msg: any): 'human' | 'system' | 'ai' | 'tool' | 'unknown' {
  // 1. По id-массиву (как у тебя в логах)
  if (Array.isArray(msg?.id)) {
    const last = msg.id[msg.id.length - 1];
    switch (last) {
      case 'HumanMessage': return 'human';
      case 'SystemMessage': return 'system';
      case 'AIMessage': return 'ai';
      case 'ToolMessage': return 'tool';
    }
  }
  // 2. По hidden _getType (если вдруг в другом окружении есть)
  const t = msg?._getType?.();
  if (t === 'human' || t === 'system' || t === 'ai' || t === 'tool') return t;

  // 3. По “признакам” kwargs
  if (msg?.kwargs) {
    if (msg.kwargs?.tool_call_id || msg.kwargs?.name === 'tool') return 'tool';
    // Иногда LangChain кладёт role в kwargs.response_metadata/или напрямую (версии отличаются)
    if (msg.kwargs?.role === 'user') return 'human';
    if (msg.kwargs?.role === 'assistant') return 'ai';
    if (msg.kwargs?.role === 'system') return 'system';
  }

  return 'unknown';
}