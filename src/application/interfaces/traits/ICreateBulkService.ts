import { Types } from 'mongoose'

export interface ICreateBulkService<TCreateDTO, TEntity> {
  createMany(data: TCreateDTO[], userId: Types.ObjectId): Promise<TEntity[]>
}
