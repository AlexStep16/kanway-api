import { Types } from 'mongoose'

export interface IArchiveService<TCriteria, TEntity> {
  archive(criteria: TCriteria, userId: Types.ObjectId): Promise<TEntity[]>
}
