export interface CategoryCriteria {
  id?: string
  ids?: string[]

  isDeleted?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  boardId?: string
  boardIds?: string[]
  name?: string
}
