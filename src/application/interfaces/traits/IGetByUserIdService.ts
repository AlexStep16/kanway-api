import { ClientSession, Types } from 'mongoose'

export interface IGetByUserIdService<TEntity> {
  getByUserId(userId: Types.ObjectId, session?: ClientSession): Promise<TEntity | null>
}
