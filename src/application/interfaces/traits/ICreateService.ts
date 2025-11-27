import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'
import { IResponseWithLog } from '@interfaces/IResponseWithLog.ts'

export interface ICreateService<TEntity, TCreateDTO> {
  create(
    data: TCreateDTO,
    user: IUser,
    session?: ClientSession
  ): Promise<IResponseWithLog<TEntity[]>>
}
