import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface IArchiveService<TCriteria, TEntity> {
  archive(criteria: TCriteria, user: IUser, session?: ClientSession): Promise<TEntity[]>
}
