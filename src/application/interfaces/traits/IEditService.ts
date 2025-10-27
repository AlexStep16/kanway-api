import { Types } from 'mongoose'

export interface IEditService<TCriteria, TEntity> {
  edit(data: Partial<TEntity>, criteria: TCriteria, userId: Types.ObjectId): Promise<TEntity[]>
}
