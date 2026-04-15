import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface ICreateManyService<TCreateDTO, TEntity> {
  createMany(
    data: TCreateDTO[],
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TEntity[]>>
}
