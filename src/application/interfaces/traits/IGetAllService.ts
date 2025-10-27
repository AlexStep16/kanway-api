import { Types } from 'mongoose'

export interface IGetAllService<TCriteria, TEntity> {
  getAll(criteria: TCriteria, userId: Types.ObjectId): Promise<TEntity[]>
}
