import { IBoardPopulated } from '@/application/interfaces/IBoardPopulated.ts'
import { ICategoryPopulated } from '@/application/interfaces/ICategoryPopulated.ts'
import { ITaskPopulated } from '@/application/interfaces/ITaskPopulated.ts'
import { IWorkspace } from '@/domain/entities/IWorkspace.ts'

export interface IActionResponse {
  create?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    categories?: ICategoryPopulated[]
    tasks?: ITaskPopulated[]
  }
  edit?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    categories?: ICategoryPopulated[]
    tasks?: ITaskPopulated[]
  }
  archive?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    categories?: ICategoryPopulated[]
    tasks?: ITaskPopulated[]
  }
  recover?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    categories?: ICategoryPopulated[]
    tasks?: ITaskPopulated[]
  }
  delete?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    categories?: ICategoryPopulated[]
    tasks?: ITaskPopulated[]
  }
  list?: {
    workspaces?: IWorkspace[]
    boards?: IBoardPopulated[]
    categories?: ICategoryPopulated[]
    tasks?: ITaskPopulated[]
  }
}
