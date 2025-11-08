import { ClientSession, Types } from 'mongoose'

export interface IEditManyService<TEntity, TEditDTO> {
  editMany(data: TEditDTO[], userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
