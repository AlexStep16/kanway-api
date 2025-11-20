import { IUser } from '@entities/IUser.ts'
import { ClientSession } from 'mongoose'

export interface IEditManyService<TEntity, TEditDTO> {
  editMany(data: TEditDTO[], user: IUser, session?: ClientSession): Promise<TEntity[]>
}
