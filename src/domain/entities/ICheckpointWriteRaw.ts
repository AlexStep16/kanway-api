export interface ICheckpointWriteRaw {
  idx: number
  task_id: string
  thread_id: string
  checkpoint_ns: string
  checkpoint_id: string
  channel: string
  type: string
  value: any
}
