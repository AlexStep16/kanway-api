import { Types } from 'mongoose'

export interface IOperationResult<TEntity> {
  entities: TEntity
  logIds: Types.ObjectId[]
}
