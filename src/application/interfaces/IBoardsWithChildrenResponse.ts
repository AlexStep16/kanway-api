import { IBoard } from '@entities/IBoard.ts'
import { ICategory } from '@entities/ICategory.ts'
import { ITask } from '@entities/ITask.ts'

export interface IBoardsWithChildrenResponse {
  boards: IBoard[]
  categories: ICategory[]
  tasks: ITask[]
}
