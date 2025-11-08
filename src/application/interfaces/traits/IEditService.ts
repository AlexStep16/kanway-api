import { ClientSession, Types } from 'mongoose'

export interface IEditService<TCriteria, TEntity, TEditDTO> {
  edit(
    data: TEditDTO,
    criteria: TCriteria,
    userId: Types.ObjectId,
    session?: ClientSession
  ): Promise<TEntity[]>
}
