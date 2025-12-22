export enum AgentRoles {
  TOOLS_RETRIEVING = 'tools_retrieving',
  CALLING_TOOLS = 'calling_tools_start',
  TOOLS_EXECUTION = 'tools_execution',
  HISTORY_RETRIEVING = 'history_retrieving',
  SYNTHESIZE_START = 'synthesize_start',
  INTEGRATION = 'integration',
  PREVIEW = 'preview',
  ASSISTANT_CHUNK = 'assistant_chunk',
  ASSISTANT_FINAL = 'assistant',
  NEW_MESSAGE = 'new_message',
}
