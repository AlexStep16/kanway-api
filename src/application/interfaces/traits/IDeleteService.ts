import { Types } from 'mongoose'

export interface IDeleteService<TCriteria> {
  delete(criteria: TCriteria, userId: Types.ObjectId): Promise<boolean>
}
