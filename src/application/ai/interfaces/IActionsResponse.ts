import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.js'
import { IColumnPopulated } from '@/application/interfaces/IColumnPopulated.js'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.js'
import { IWorkspace } from '@/domain/entities/IWorkspace.js'

export interface IActionResponse {
  create?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    columns?: IColumnPopulated[]
    tasks?: ITaskPopulated[]
  }
  edit?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    columns?: IColumnPopulated[]
    tasks?: ITaskPopulated[]
  }
  archive?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    columns?: IColumnPopulated[]
    tasks?: ITaskPopulated[]
  }
  recover?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    columns?: IColumnPopulated[]
    tasks?: ITaskPopulated[]
  }
  delete?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    columns?: IColumnPopulated[]
    tasks?: ITaskPopulated[]
  }
  list?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    columns?: IColumnPopulated[]
    tasks?: ITaskPopulated[]
  }
}
