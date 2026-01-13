import { Types } from 'mongoose'

export type SingleUpdateDTO<TEntity> = Partial<TEntity> & {
  id: Types.ObjectId
}
