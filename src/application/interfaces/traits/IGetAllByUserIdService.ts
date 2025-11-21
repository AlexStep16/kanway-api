import { ClientSession, Types } from 'mongoose'

export interface IGetAllByUserIdService<TEntity> {
  getAllByUserId(userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
