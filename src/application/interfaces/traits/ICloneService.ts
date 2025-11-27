import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface ICloneService<TCriteria, TClonedResult> {
  clone(
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TClonedResult>>
}
