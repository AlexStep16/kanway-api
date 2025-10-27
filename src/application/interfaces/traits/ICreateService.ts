import { Types } from 'mongoose'

export interface ICreateService<TEntity, TCreateDTO> {
  create(data: TCreateDTO, userId: Types.ObjectId): Promise<TEntity>
}
