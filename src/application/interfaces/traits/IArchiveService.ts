import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface IArchiveService<TCriteria, TEntity> {
  archive(
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TEntity>>
}
