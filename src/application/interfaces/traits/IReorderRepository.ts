import { IReordable } from '@entities/IReordable.ts'
import { ClientSession, Types } from 'mongoose'

export interface IReorderRepository<TEntity> {
  getAllToOrder(parentId: string, userId: Types.ObjectId): Promise<TEntity[]>
  bulkUpdateOrders(updates: IReordable[], session?: ClientSession): Promise<void>
}
