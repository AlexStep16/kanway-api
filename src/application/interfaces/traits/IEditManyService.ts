import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface IEditManyService<TEntity, TEditDTO> {
  editMany(
    data: TEditDTO[],
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TEntity[]>>
}
