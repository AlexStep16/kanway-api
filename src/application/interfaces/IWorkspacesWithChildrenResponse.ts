import { IWorkspace } from '@entities/IWorkspace.ts'
import { IBoard } from '@entities/IBoard.ts'
import { ICategory } from '@entities/ICategory.ts'
import { ITask } from '@entities/ITask.ts'

export interface IWorkspacesWithChildrenResponse {
  workspaces: IWorkspace[]
  boards: IBoard[]
  categories: ICategory[]
  tasks: ITask[]
}
