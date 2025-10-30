import { ClientSession, Types } from 'mongoose'

export interface IGetCountService<TCriteria> {
  getCount(criteria: TCriteria, userId: Types.ObjectId, session?: ClientSession): Promise<number>
}
