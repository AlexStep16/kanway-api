import { ClientSession, Types } from 'mongoose'

export interface IDeleteService<TEntity, TCriteria> {
  delete(criteria: TCriteria, userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
