import { ClientSession, Types } from 'mongoose'

export interface IArchiveService<TCriteria, TEntity> {
  archive(criteria: TCriteria, userId: Types.ObjectId, session?: ClientSession): Promise<TEntity[]>
}
