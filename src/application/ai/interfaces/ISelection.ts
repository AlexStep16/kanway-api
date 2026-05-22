export interface ISelection {
  id: string
  entityType: 'task' | 'category' | 'board' | 'workspace'
  entityIds: string[]
  query: Record<string, any>
  sample: Record<string, any>[]
  count: number
  userId: string
}
