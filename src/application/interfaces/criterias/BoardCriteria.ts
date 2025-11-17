export interface BoardCriteria {
  id?: string
  ids?: string[]

  isDeleted?: boolean
  isDeletedExternal?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  name?: string
}
