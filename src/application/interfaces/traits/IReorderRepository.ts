import { IReordable } from '@entities/IReordable.ts'
import { ClientSession, Types } from 'mongoose'

export interface IReorderRepository<TEntity> {
  getAllToOrder(
    parentId: Types.ObjectId,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]>
  bulkUpdateOrders(updates: IReordable[], session?: ClientSession): Promise<void>
  findByIds(
    ids: Types.ObjectId[],
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]>
}
