export interface ApproveToolCallDTO {
  toolCallId: string
  chatMessageId: string
  boardId: string
  isConfirmed: boolean
  isCancelled: boolean
  workspaceId: string
  timezone: string
}
