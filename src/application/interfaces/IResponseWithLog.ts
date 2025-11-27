import { Types } from 'mongoose'

export interface IResponseWithLog<TEntity> {
  data: TEntity
  logId: Types.ObjectId | null
}
