import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface IEditService<TCriteria, TEntity, TEditDTO> {
  edit(
    data: TEditDTO,
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TEntity[]>>
}
