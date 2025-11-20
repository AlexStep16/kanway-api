import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface ICloneService<TCriteria, TClonedResult> {
  clone(criteria: TCriteria, user: IUser, session?: ClientSession): Promise<TClonedResult>
}
