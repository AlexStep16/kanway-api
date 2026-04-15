import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface ICloneService<TCriteria, TClonedResult> {
  clone(
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TClonedResult>>
}
