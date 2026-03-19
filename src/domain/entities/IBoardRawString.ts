export interface IBoardRawString {
  _id: string
  name: string
  workspace: string
  user_id: string
  is_favorite: boolean
  tasks_count: number
  categories_count: number
  rank: string
  embeddings: Array<number>
  is_deleted: boolean
  is_deleted_external: boolean
  deleted_time?: Date | null
  createdAt: Date
  updatedAt: Date
}
