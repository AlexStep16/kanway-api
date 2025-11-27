import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface ICreateManyService<TCreateDTO, TEntity> {
  createMany(
    data: TCreateDTO[],
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TEntity[]>>
}
