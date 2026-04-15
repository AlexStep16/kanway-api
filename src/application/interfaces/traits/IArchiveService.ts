import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface IArchiveService<TCriteria, TEntity> {
  archive(
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TEntity>>
}
