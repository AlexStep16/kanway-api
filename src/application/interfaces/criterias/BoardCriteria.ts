export interface BoardCriteria {
  id?: string
  ids?: string[]

  isDeleted?: boolean
  workspaceId?: string
  workspaceIds?: string[]
  name?: string
}
