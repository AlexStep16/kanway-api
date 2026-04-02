export interface ICheckpoint {
  threadId: string
  checkpointNs: string
  checkpointId: string
  checkpoint: any
  metadata?: any
  parentCheckpointId?: string
}
