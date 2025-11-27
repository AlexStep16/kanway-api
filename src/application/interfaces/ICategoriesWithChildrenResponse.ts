import { ITask } from '@entities/ITask.ts'
import { ICategory } from '@entities/ICategory.ts'

export interface ICategoriesWithChildrenResponse {
  categories: ICategory[]
  tasks: ITask[]
}
