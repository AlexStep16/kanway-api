import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface IEditService<TCriteria, TEntity, TEditDTO> {
  edit(
    data: TEditDTO,
    criteria: TCriteria,
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TEntity[]>>
}
