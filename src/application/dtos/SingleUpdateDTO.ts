import { Types } from 'mongoose'

export type SingleUpdateDTO<TEntity> = Partial<TEntity> & {
  _id: Types.ObjectId
}
