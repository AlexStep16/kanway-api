import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface IEditNoLogService<TCriteria, TEntity, TEditDTO> {
  edit(
    data: TEditDTO,
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession
  ): Promise<TEntity[]>
}
