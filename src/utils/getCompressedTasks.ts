import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'

interface CompressedTask {
  id: string
  name: string
  categoryName?: string
  description?: string
  isCompleted: boolean
  dueDate?: string
}

export function getCompressedTasks(tasks: ITaskPopulated[]): Array<CompressedTask> {
  return tasks.map((task) => ({
    id: task.id.toString(),
    name: task.name,
    categoryName: task.category.name,
    boardName: task.board.name,
    workspaceName: task.workspace.name,
    description: task.description ? task.description.slice(0, 100) : '',
    isCompleted: task.isCompleted,
    dueDate: task.dueDate,
  }))
}
