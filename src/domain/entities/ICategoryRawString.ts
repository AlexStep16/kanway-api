export interface ICategoryRawString {
  _id: string
  name: string
  workspace: string
  board: string
  user_id: string
  tasks_count: number
  rank: string
  embeddings: Array<number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
