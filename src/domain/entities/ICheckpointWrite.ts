export interface ICheckpointWrite {
  idx: number
  taskId: string
  threadId: string
  checkpointNs: string
  checkpointId: string
  channel: string
  type: string
  value: any
}
