import { IColumn } from '@/domain/entities/IColumn.js'
import { Types } from 'mongoose'

export type IColumnPopulated = IColumn<
  {
    id: Types.ObjectId
    name: string
  },
  {
    id: Types.ObjectId
    name: string
  }
>
