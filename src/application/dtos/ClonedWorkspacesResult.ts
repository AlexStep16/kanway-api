import { IWorkspace } from '@entities/IWorkspace.ts'
import { IBoard } from '@entities/IBoard.ts'
import { ICategoryServerResponse } from '@entities/ICategoryServerResponse.ts'
import { ITaskServerResponse } from '@entities/ITaskServerResponse.ts'

export interface ClonedWorkspacesResult {
  workspaces: IWorkspace[]
  boards: IBoard[]
  categories: ICategoryServerResponse[]
  tasks: ITaskServerResponse[]
}
