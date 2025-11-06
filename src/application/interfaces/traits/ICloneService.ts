import { Types } from 'mongoose'

export interface ICloneService<TEntity, TCriteria> {
  clone(criteria: TCriteria, userId: Types.ObjectId): Promise<TEntity[]>
}
