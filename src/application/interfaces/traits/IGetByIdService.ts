import { Types } from 'mongoose'

export interface IGetByIdService<TEntity> {
  getById(id: string, userId: Types.ObjectId): Promise<TEntity | null>
}
