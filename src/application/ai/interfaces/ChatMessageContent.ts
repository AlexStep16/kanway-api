export interface ChatMessageContent {
  callId: string
  title: string
  functionName: string
  context: any
  isConfirmed?: boolean
  isCancelled?: boolean
}
