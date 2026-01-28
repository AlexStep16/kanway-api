export interface ApproveToolCallDTO {
  toolCallId: string
  chatMessageId: string
  boardId: string
  isConfirmed: boolean
  isCancelled: boolean
  cancelledEntityIds: string[]
  workspaceId: string
  timezone: string
}
