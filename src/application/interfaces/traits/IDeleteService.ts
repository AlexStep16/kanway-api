import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'

export interface IDeleteService<TEntity, TCriteria> {
  delete(criteria: TCriteria, user: IUser, session?: ClientSession): Promise<TEntity[]>
}
