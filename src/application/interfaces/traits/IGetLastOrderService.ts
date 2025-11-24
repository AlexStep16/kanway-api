import { ClientSession, Types } from 'mongoose'

export interface IGetLastOrderService {
  getLastOrder(parentId: string, userId: Types.ObjectId, session?: ClientSession): Promise<number>
}
