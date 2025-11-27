import { ClientSession } from 'mongoose'
import { IUser } from '@entities/IUser.ts'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface IRecoverService<TCriteria, TEntity> {
  recover(
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TEntity>>
}
