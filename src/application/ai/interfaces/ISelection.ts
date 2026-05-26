export interface ISelection {
  id: string
  entityType: 'task' | 'category' | 'board' | 'workspace'
  entityIds: string[]
  humanReadableFilter: string
  sample: Record<string, any>[]
  count: number
  userId: string
}
