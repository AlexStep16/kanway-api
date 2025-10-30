import { IOperationLog } from '@entities/IOperationLog.ts'

export interface ReorderResultDTO<TEntity> {
  updatedEntities: TEntity[]
  log: IOperationLog | null
}
