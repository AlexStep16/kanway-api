import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'

export interface IEditNoLogService<TCriteria, TEntity, TEditDTO> {
  edit(
    data: TEditDTO,
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<TEntity[]>
}
