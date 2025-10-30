import { ClientSession, Types } from 'mongoose'

export interface IGetAllService<TCriteria, TEntity> {
  getAll(criteria: TCriteria, userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
