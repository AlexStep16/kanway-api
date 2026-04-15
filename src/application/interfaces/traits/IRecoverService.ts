import { ClientSession } from 'mongoose'
import { IUser } from '@entities/IUser.js'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface IRecoverService<TCriteria, TEntity> {
  recover(
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TEntity>>
}
