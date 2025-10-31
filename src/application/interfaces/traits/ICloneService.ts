import { Types } from 'mongoose'

export interface ICloneService<TEntity> {
  clone(id: string, userId: Types.ObjectId): Promise<TEntity>
}
