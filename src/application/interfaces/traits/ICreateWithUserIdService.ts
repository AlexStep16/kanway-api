import { ClientSession, Types } from 'mongoose'

export interface ICreateWithUserIdService<TEntity, TCreateDTO> {
  create(data: TCreateDTO, userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
