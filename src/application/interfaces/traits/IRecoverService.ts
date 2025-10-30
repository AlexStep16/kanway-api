import { ClientSession, Types } from 'mongoose'

export interface IRecoverService<TCriteria, TEntity> {
  recover(criteria: TCriteria, userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
