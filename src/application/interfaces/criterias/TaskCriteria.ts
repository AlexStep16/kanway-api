export interface TaskCriteria {
  id?: string
  ids?: string[]

  isDeleted?: boolean
  boardId?: string
  boardIds?: string[]
  workspaceId?: string
  workspaceIds?: string[]
  categoryId?: string
  categoryIds?: string[]
  name?: string
}
