import { ClientSession, Types } from 'mongoose'

export interface IGetByIdService<TEntity> {
  getById(id: string, userId: Types.ObjectId, session?: ClientSession): Promise<TEntity | null>
}
