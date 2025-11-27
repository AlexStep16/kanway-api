import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface IEditManyService<TEntity, TEditDTO> {
  editMany(
    data: TEditDTO[],
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TEntity[]>>
}
