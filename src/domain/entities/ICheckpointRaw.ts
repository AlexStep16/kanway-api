export interface ICheckpointRaw {
  thread_id: string
  checkpoint_ns: string
  checkpoint_id: string
  checkpoint: any
  metadata?: any
  parent_checkpoint_id?: string
}
