import { ClientSession, Types } from 'mongoose'

export interface IEditService<TCriteria, TEntity, TEditDTO> {
  edit(
    data: Partial<TEditDTO>,
    criteria: TCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]>
}
