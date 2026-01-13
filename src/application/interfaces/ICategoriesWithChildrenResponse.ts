import { ICategoryPopulated } from './ICategoryPopulated.ts'
import { ITaskPopulated } from './ITaskPopulated.ts'

export interface ICategoriesWithChildrenResponse {
  categories: ICategoryPopulated[]
  tasks: ITaskPopulated[]
}
