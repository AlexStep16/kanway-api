import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface ICreateManyService<TCreateDTO, TEntity> {
  createMany(data: TCreateDTO[], user: IUser, session?: ClientSession): Promise<TEntity[]>
}
