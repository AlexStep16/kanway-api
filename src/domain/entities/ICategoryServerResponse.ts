import { ICategory } from '@entities/ICategory.ts'

export interface ICategoryServerResponse extends ICategory {
  tempClientId?: string
}
