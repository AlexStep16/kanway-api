import { Types } from 'mongoose'

export interface IGetCountService<TCriteria> {
  getCount(criteria: TCriteria, userId: Types.ObjectId): Promise<number>
}
