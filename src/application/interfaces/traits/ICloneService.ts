import { Types } from 'mongoose'

export interface ICloneService<TCriteria, TClonedResult> {
  clone(criteria: TCriteria, userId: Types.ObjectId): Promise<TClonedResult>
}
