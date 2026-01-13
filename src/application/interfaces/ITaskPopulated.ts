import { ITask } from '@/domain/entities/ITask.ts'
import { Types } from 'mongoose'

export type ITaskPopulated = ITask<
  {
    id: Types.ObjectId
    name: string
  },
  {
    id: Types.ObjectId
    name: string
  },
  {
    id: Types.ObjectId
    name: string
  }
>
