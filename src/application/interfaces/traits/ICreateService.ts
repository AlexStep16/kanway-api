import { IUser } from '@entities/IUser.js'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.js'

export interface ICreateService<TEntity, TCreateDTO> {
  create(
    data: TCreateDTO,
    user: IUser,
    session?: ClientSession,
  ): Promise<IResponseWithLog<TEntity[]>>
}
