import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface ICreateService<TEntity, TCreateDTO> {
  create(data: TCreateDTO, user: IUser, session?: ClientSession): Promise<TEntity[]>
}
