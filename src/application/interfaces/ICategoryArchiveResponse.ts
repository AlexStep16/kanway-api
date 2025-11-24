import { ITask } from '@entities/ITask.ts'
import { ICategory } from '@entities/ICategory.ts'

export interface ICategoryArchiveResponse {
  categories: ICategory[]
  tasks: ITask[]
}
