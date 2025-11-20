import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface IDeleteService<TEntity, TCriteria> {
  delete(criteria: TCriteria, user: IUser, session?: ClientSession): Promise<TEntity[]>
}
