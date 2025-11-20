import { ClientSession } from 'mongoose'

export interface ICreateUserService<TEntity, TCreateDTO> {
  create(data: TCreateDTO, session?: ClientSession): Promise<TEntity[]>
}
