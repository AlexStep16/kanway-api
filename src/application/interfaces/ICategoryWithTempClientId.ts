import { ICategory } from '@entities/ICategory.ts'

export type ICategoryWithTempClientId = ICategory & { tempClientId?: string }
