import { ICategoryServerResponse } from '@entities/ICategoryServerResponse.ts'
import { ITaskServerResponse } from '@entities/ITaskServerResponse.ts'

export interface ClonedCategoriesResult {
  categories: ICategoryServerResponse[]
  tasks: ITaskServerResponse[]
}
