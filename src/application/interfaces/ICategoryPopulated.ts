import { ICategory } from '@/domain/entities/ICategory.ts'
import { Types } from 'mongoose'

export type ICategoryPopulated = ICategory<
  {
    id: Types.ObjectId
    name: string
  },
  {
    id: Types.ObjectId
    name: string
  }
>
