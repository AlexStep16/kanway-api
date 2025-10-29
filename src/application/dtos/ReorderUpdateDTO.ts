import { Types } from 'mongoose'

export interface ReorderUpdateDTO {
  _id: Types.ObjectId
  order: number
  parentId: Types.ObjectId
}
